// src/controllers/punchController.ts
import { Request, Response } from "express";
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

const upload = multer({ storage: multer.memoryStorage() });

export const punch = [
  upload.single("selfie"),
  async (req: any, res: Response) => {
    const { type, date, location } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?._id;

    if (type === "in") {
      await closeStaleSession(userId);

      // Prevent duplicate punch-in: check if already punched in today with no punch-out after
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const latestPunch = await Punch.findOne({ user: userId, date: { $gte: today } })
        .sort({ time: -1 })
        .lean();
      if (latestPunch && latestPunch.type === "in") {
        return res.status(400).json({ message: "Already punched in" });
      }
    }

    if (type === "out") {
      // Prevent an orphan punch-out: there must be an OPEN session (latest punch
      // today is an "in") before we accept an "out". Without this guard a client
      // with stale state can record a punch-out with no preceding punch-in, which
      // produces "punch-out before punch-in" rows in the admin attendance table.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const latestPunch = await Punch.findOne({ user: userId, date: { $gte: today } })
        .sort({ time: -1 })
        .lean();
      if (!latestPunch || latestPunch.type !== "in") {
        return res.status(400).json({ message: "Not punched in" });
      }
    }

    try {
      // Upload selfie
      const selfieResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });

      const punch = new Punch({
        user: userId,
        type,
        date: new Date(date),
        time: new Date(),
        location: JSON.parse(location),
        selfie: (selfieResult as any).secure_url,
      });

      await punch.save();

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
            selfie: punch.selfie,
            type,
            isLate: punch.isLate,
          });
        } catch (bgErr) {
          console.error("[Punch] Background side-effect failed:", bgErr);
        }
      })();
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: "Error" });
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