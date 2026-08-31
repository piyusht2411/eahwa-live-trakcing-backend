// src/controllers/punchController.ts
import { NextFunction, Request, Response } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import Punch from "../models/punch";
import User from "../models/user";
import { updatePunchSheet } from "../services/googleSheetsService";
import { AuthRequest } from "../types/authRequest";
import { closeStaleSession } from "../utils/closeStaleSession";
import { persistDailyTravelDistance } from "../utils/persistTravelDistance";
import Alert from "../models/alert";
import { sendAnomalyAlert } from "../services/notificationService";

// 12 MB ceiling: a punch selfie is ~200-400 KB after the client downscales it.
// Anything far above that is a misbehaving client, and letting it stream without
// a bound just holds the request open until the client gives up.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

/**
 * A client that lost its connection mid-upload retries the punch. If the first
 * attempt actually landed, the duplicate guards below would reject the retry
 * ("Already punched in" / "Not punched in") even though the punch succeeded,
 * leaving the user stuck. Treat a same-type punch from the last few minutes as
 * the same punch and replay the original response instead.
 */
const RETRY_WINDOW_MS = 3 * 60 * 1000;

const isRecent = (punch: any) =>
  Date.now() - new Date(punch.time).getTime() < RETRY_WINDOW_MS;

/**
 * Push the selfie to Cloudinary, but never let it hold the punch hostage.
 * Attendance is the record that matters; the selfie is corroboration. If the
 * upload is slower than `timeoutMs` we resolve null, save the punch, and finish
 * the upload in the background.
 */
const uploadSelfie = (buffer: Buffer): Promise<string | null> =>
  new Promise((resolve) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "auto" }, (error, result) => {
        if (error) {
          console.error("[Punch] Cloudinary upload failed:", error.message);
          return resolve(null);
        }
        resolve(result?.secure_url ?? null);
      })
      .end(buffer);
  });

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);

const SELFIE_UPLOAD_TIMEOUT_MS = 8000;

export const punch = [
  upload.single("selfie"),
  // Turn multer's rejections (oversized file, malformed multipart) into a clear
  // client error instead of a generic 500 from the global handler.
  (err: any, _req: Request, res: Response, next: NextFunction) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Selfie is too large. Please try again." });
    }
    console.error("[Punch] Upload error:", err);
    return res.status(400).json({ message: "Could not read the selfie upload." });
  },
  async (req: any, res: Response) => {
    const { type, date, location } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?._id;

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Selfie is required" });
    }

    let parsedLocation;
    try {
      parsedLocation = JSON.parse(location);
    } catch {
      return res.status(400).json({ message: "Invalid location" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (type === "in") {
      await closeStaleSession(userId);

      // Prevent duplicate punch-in: check if already punched in today with no punch-out after
      const latestPunch = await Punch.findOne({ user: userId, date: { $gte: today } })
        .sort({ time: -1 })
        .lean();
      if (latestPunch && latestPunch.type === "in") {
        if (isRecent(latestPunch)) {
          return res.status(201).json({ message: "Punch recorded", punch: latestPunch });
        }
        return res.status(400).json({ message: "Already punched in" });
      }
    }

    if (type === "out") {
      // Prevent an orphan punch-out: there must be an OPEN session (latest punch
      // today is an "in") before we accept an "out". Without this guard a client
      // with stale state can record a punch-out with no preceding punch-in, which
      // produces "punch-out before punch-in" rows in the admin attendance table.
      const latestPunch = await Punch.findOne({ user: userId, date: { $gte: today } })
        .sort({ time: -1 })
        .lean();
      if (!latestPunch || latestPunch.type !== "in") {
        if (latestPunch?.type === "out" && isRecent(latestPunch)) {
          return res.status(201).json({ message: "Punch recorded", punch: latestPunch });
        }
        return res.status(400).json({ message: "Not punched in" });
      }
    }

    try {
      const selfieBuffer = req.file.buffer as Buffer;
      const uploadPromise = uploadSelfie(selfieBuffer);
      const selfieUrl = await withTimeout(uploadPromise, SELFIE_UPLOAD_TIMEOUT_MS);

      const punch = new Punch({
        user: userId,
        type,
        date: new Date(date),
        time: new Date(),
        location: parsedLocation,
        selfie: selfieUrl,
      });

      await punch.save();

      // Cloudinary was still going when we hit the deadline — let it land and
      // attach the URL afterwards rather than making the user wait for it.
      if (!selfieUrl) {
        void uploadPromise
          .then(async (url) => {
            if (!url) return;
            await Punch.updateOne({ _id: punch._id }, { $set: { selfie: url } });
          })
          .catch((err) => console.error("[Punch] Late selfie attach failed:", err));
      }

      // Respond as soon as the punch is persisted. Everything below (distance
      // calc via OSRM, Google Sheet sync, alerts) is secondary and slow — running
      // it before responding is what caused the 30s client timeout. We fire it
      // off after the response so the user gets instant confirmation.
      res.status(201).json({ message: "Punch recorded", punch });

      // ── Background side-effects: never block or fail the punch response ──
      void (async () => {
        try {
          // Late punch-in alert — applies to all employee types.
          if (type === "in" && punch.isLate) {
            const userName = authReq.user?.name || String(userId);
            const description = `${userName} punched in late at ${punch.time.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST (after 10:15 AM)`;
            await Alert.create({ user: userId, type: "late_arrival", description });
            if (process.env.HR_WHATSAPP_TO) {
              sendAnomalyAlert(String(userId), userName, "late_arrival", description).catch((err) =>
                console.error("Late punch-in WhatsApp alert failed:", err.message)
              );
            }
          }

          // On punch-out: calculate today's distance and save to user's travelHistory
          // + Performance (shared with the automatic punch-out paths).
          if (type === "out") {
            try {
              await persistDailyTravelDistance(String(userId));
            } catch (err) {
              console.error("[Punch Out] Failed to save travel distance:", err);
            }
          }

          // Fetch manager name if available
          let managerName = "";
          if (authReq.user?.managedBy) {
            const manager = await User.findById(authReq.user.managedBy).select("name");
            managerName = manager?.name || "";
          }

          // Update Google Sheet
          await updatePunchSheet({
            employeeName: authReq.user?.name,
            employeeId: authReq.user?.employeeId,
            department: authReq.user?.department,
            manager: managerName,
            date: punch.date,
            time: punch.time,
            location: punch.location,
            selfie: punch.selfie ?? (await uploadPromise),
            type,
            isLate: punch.isLate,
          });
        } catch (bgErr) {
          console.error("[Punch] Background side-effect failed:", bgErr);
        }
      })();
    } catch (error) {
      console.error("[Punch] Failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error" });
      }
    }
  },
];

export const getTodayStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const punches = await Punch.find({
      user: userId,
      date: { $gte: today, $lt: tomorrow },
    }).sort({ time: 1 });

    let isPunchedIn = false;
    let punchInTime = null;
    let punchOutTime = null;
    let isAutomaticOut = false;
    let isLatePunchIn = false;

    if (punches.length > 0) {
      const firstIn = punches.find((p) => p.type === "in");
      if (firstIn) {
        punchInTime = firstIn.time;
        isLatePunchIn = firstIn.isLate || false;
      }

      const lastOut = [...punches].reverse().find((p) => p.type === "out");
      if (lastOut) {
        punchOutTime = lastOut.time;
        isAutomaticOut = lastOut.isAutomatic || false;
      }

      const lastPunch = punches[punches.length - 1];
      isPunchedIn = lastPunch.type === "in";
    }

    res.status(200).json({
      success: true,
      data: {
        isPunchedIn,
        punchInTime,
        punchOutTime,
        isAutomaticOut,
        isLatePunchIn,
        punchesToday: punches.length,
      },
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTodayPunchIn = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Try finding today's punch-in first
    let punchIn = await Punch.findOne({
      user: userId,
      type: "in",
      date: { $gte: today, $lt: tomorrow },
    }).sort({ time: -1 });

    // Fallback to the latest punch-in overall if none found for today
    if (!punchIn) {
      punchIn = await Punch.findOne({
        user: userId,
        type: "in",
      }).sort({ time: -1 });
    }

    if (!punchIn) {
      return res.status(404).json({ success: false, message: "No punch-in record found for this user" });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: String(punchIn.user),
        punchId: String(punchIn._id),
        lat: punchIn.location?.lat,
        lng: punchIn.location?.lng,
        address: punchIn.location?.address || "",
      },
    });
  } catch (error) {
    console.error("Get punch-in error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updatePunchInLocation = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { punchId, lat, lng, address } = req.body;

  try {
    let punchRecord;
    if (punchId) {
      punchRecord = await Punch.findById(punchId);
    } else {
      // Fallback: update latest punch-in if punchId is not provided
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      punchRecord = await Punch.findOne({
        user: userId,
        type: "in",
        date: { $gte: today, $lt: tomorrow },
      }).sort({ time: -1 });

      if (!punchRecord) {
        punchRecord = await Punch.findOne({
          user: userId,
          type: "in",
        }).sort({ time: -1 });
      }
    }

    if (!punchRecord) {
      return res.status(404).json({ success: false, message: "Punch record not found" });
    }

    // Verify user ID matches
    if (String(punchRecord.user) !== userId) {
      return res.status(400).json({ success: false, message: "Punch record does not belong to this user" });
    }

    // Update location
    if (lat !== undefined) punchRecord.location.lat = Number(lat);
    if (lng !== undefined) punchRecord.location.lng = Number(lng);
    if (address !== undefined) punchRecord.location.address = address;

    await punchRecord.save();

    res.status(200).json({
      success: true,
      message: "Punch-in location updated successfully",
      data: {
        userId: String(punchRecord.user),
        punchId: String(punchRecord._id),
        lat: punchRecord.location.lat,
        lng: punchRecord.location.lng,
        address: punchRecord.location.address,
      },
    });
  } catch (error) {
    console.error("Update punch-in error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};