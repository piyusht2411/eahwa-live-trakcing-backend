// src/controllers/locationController.ts
import { Request, Response } from "express";
import LocationLog from "../models/locationlogs";
import User from "../models/user";
import Alert from "../models/alert";
import Punch from "../models/punch";
import { detectAnomalies } from "../services/anomalyService";
import { Types } from "mongoose";
import { getIO } from "../socket";

import { sendOfflineAlert, sendDeviceAlert, sendAnomalyAlert } from "../services/notificationService";

export const logLocation = async (req: Request, res: Response) => {
  const {
    location, speed, battery,
    isOffline, gpsDisabled, internetDisabled, deviceOff,
  } = req.body;
  const userId = (req as any).user._id;

  try {
    // Skip logging if user has not punched in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestPunch = await Punch.findOne({ user: userId, date: { $gte: today } })
      .sort({ time: -1 })
      .lean();

    if (!latestPunch || latestPunch.type === "out") {
      return res.json({ message: "Not punched in, location not logged" });
    }

    const parsedLocation =
      typeof location === "string" ? JSON.parse(location) : location;

    const log = new LocationLog({
      user: userId,
      location: parsedLocation,
      speed,
      battery,
      isOffline,
    });

    await log.save();
    await User.findByIdAndUpdate(userId, { lastLocationAt: new Date() });
    await detectAnomalies(userId, log);

    // Emit real-time location to any watchers
    getIO().to(`location:${userId}`).emit("location:update", {
      userId,
      location: parsedLocation,
      speed,
      battery,
      isOffline,
      timestamp: log.timestamp,
    });

    // ── Offline duration alert ──────────────────────────────────────────────
    // if (isOffline) {
    //   const lastOnlineLog = await LocationLog.findOne({
    //     user: userId,
    //     isOffline: false,
    //   })
    //     .sort({ timestamp: -1 })
    //     .lean();

    //   if (lastOnlineLog) {
    //     const offlineDurationMs =
    //       Date.now() - new Date(lastOnlineLog.timestamp).getTime();
    //     const offlineDurationHours = offlineDurationMs / (1000 * 60 * 60);

    //     if (offlineDurationHours >= 1) {
    //       const durationStr = offlineDurationHours.toFixed(2);
    //       const description = `User offline for ${durationStr} hours`;

    //       await Alert.create({
    //         user: userId,
    //         type: "offline_long",
    //         description,
    //       });

    //       if (process.env.HR_WHATSAPP_TO) {
    //         // Fetch name for a friendlier template variable
    //         const user = await User.findById(userId).lean();
    //         await sendOfflineAlert(
    //           String(userId),
    //           user?.name ?? String(userId), // {{1}}
    //           durationStr                   // {{2}}
    //         );
    //       }
    //     }
    //   }
    // }

    // ── Device / GPS / Internet alerts ─────────────────────────────────────
    const alertPromises: Promise<unknown>[] = [];
    const alertDescriptions: string[] = [];

    // if (gpsDisabled) {
    //   alertDescriptions.push("GPS disabled on device");
    //   alertPromises.push(
    //     Alert.create({ user: userId, type: "gps_disabled", description: "GPS disabled on device" })
    //   );
    // }

    // if (internetDisabled) {
    //   alertDescriptions.push("Internet disabled on device");
    //   alertPromises.push(
    //     Alert.create({ user: userId, type: "internet_disabled", description: "Internet disabled on device" })
    //   );
    // }

    // if (deviceOff) {
    //   alertDescriptions.push("Device switched off");
    //   alertPromises.push(
    //     Alert.create({ user: userId, type: "device_off", description: "Device switched off" })
    //   );
    // }

    // if (alertPromises.length > 0) {
    //   await Promise.all(alertPromises);

    //   if (process.env.HR_WHATSAPP_TO) {
    //     const user = await User.findById(userId).lean();
    //     await sendDeviceAlert(
    //       String(userId),
    //       user?.name ?? String(userId), // {{1}}
    //       alertDescriptions             // {{2}}
    //     );
    //   }
    // }

    res.json({ message: "Location logged" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error" });
  }
};

export const getLiveTrack = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;

  try {
    // Hierarchy check in middleware
    const logs = await LocationLog.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("user", "name");

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const getHeatMap = async (req: Request, res: Response) => {
  const { start, end } = req.query;
  const authUser: any = (req as any).user;
  const authUserId = authUser._id;

  try {
    const timeQuery: any = {
      timestamp: {
        $gte: new Date(start as string),
        $lte: new Date(end as string),
      },
    };

    // For admin/HR: full map; for manager: only team; for employee: self only
    if (authUser.role === "manager") {
      const team = await User.find({ managedBy: authUserId }).select("_id");
      timeQuery.user = { $in: team.map((u: any) => u._id) };
    } else if (authUser.role === "employee") {
      timeQuery.user = authUserId;
    }

    const logs = await LocationLog.aggregate([
      { $match: timeQuery },
      {
        $group: {
          _id: {
            lat: { $round: ["$location.lat", 4] },
            lng: { $round: ["$location.lng", 4] },
          },
          count: { $sum: 1 },
          avgTime: { $avg: "$timestamp" },
        },
      },
    ]);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

// Haversine distance in km between two lat/lng points
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Called by cron job (cron-job.org) every 30 min between 9 AM – 1 PM
// Checks: user punched in 30+ min ago but all location logs still within 100m of home
export const checkHomeIdleUsers = async (req: Request, res: Response) => {
  const HOME_RADIUS_KM = 0.1;     // 100 metres
  const IDLE_MINUTES   = 30;

  try {
    const now   = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000);

    // Find all punch-ins today that happened at least 30 min ago
    const punchIns = await Punch.find({
      type: "in",
      date: { $gte: today },
      time: { $lte: cutoff },
    })
      .populate<{ user: any }>("user", "name homeLocation role")
      .lean();

    const alerted: string[] = [];

    for (const punch of punchIns) {
      const user = punch.user as any;
      if (!user?.homeLocation?.lat || !user?.homeLocation?.lng) continue;

      // Skip if we already sent this alert today
      const existingAlert = await Alert.findOne({
        user: user._id,
        type: "no_movement",
        timestamp: { $gte: today },
      }).lean();
      if (existingAlert) continue;

      // Get all location logs since punch-in
      const logs = await LocationLog.find({
        user: user._id,
        timestamp: { $gte: new Date(punch.time) },
      }).lean();

      if (logs.length === 0) continue;

      // Check if every log is within 100m of home
      const allAtHome = logs.every((log: any) =>
        haversineKm(
          user.homeLocation.lat,
          user.homeLocation.lng,
          log.location.lat,
          log.location.lng
        ) <= HOME_RADIUS_KM
      );

      if (!allAtHome) continue;

      // Create alert
      const description = `${user.name} punched in ${IDLE_MINUTES}+ min ago but has not moved from home location`;
      await Alert.create({ user: user._id, type: "no_movement", description });

      // Notify HR (fire-and-forget)
      if (process.env.HR_WHATSAPP_TO) {
        sendAnomalyAlert(String(user._id), user.name, "no_movement", description).catch((err) =>
          console.error("Home-idle WhatsApp alert failed:", err.message)
        );
      }

      alerted.push(user.name);
    }

    res.json({ checked: punchIns.length, alerted });
  } catch (error) {
    console.error("checkHomeIdleUsers error:", error);
    res.status(500).json({ message: "Error" });
  }
};

export const getTodayLocationHistory = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Validate ObjectId
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // Calculate today (00:00:00 to 23:59:59)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logs = await LocationLog.find({
      user: userId,
      timestamp: { $gte: today, $lt: tomorrow },   // ← Today only
    })
      .select("location timestamp speed battery")   // Only fields needed for map
      .sort({ timestamp: 1 })                       // ← Oldest to newest (perfect for polyline)
      .lean();

    res.status(200).json({
      success: true,
      data: logs,
      totalPoints: logs.length,
      date: today.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Today location history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};