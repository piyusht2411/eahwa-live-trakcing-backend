// src/controllers/locationController.ts
import { Request, Response } from "express";
import LocationLog from "../models/locationlogs";
import User from "../models/user";
import Alert from "../models/alert";
import { detectAnomalies } from "../services/anomalyService";
import { sendWhatsAppAlert } from "../services/notificationService";
import { Types } from "mongoose";

export const logLocation = async (req: Request, res: Response) => {
  const {
    location,
    speed,
    battery,
    isOffline,
    gpsDisabled,
    internetDisabled,
    deviceOff,
  } = req.body;
  const userId = (req as any).user._id;

  try {
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

    // Update user's tracking timestamp for heartbeat cron
    await User.findByIdAndUpdate(userId, { lastLocationAt: new Date() });

    // Detect anomalies on each location log
    await detectAnomalies(userId, log);

    // Offline tracking: log long offline durations and alert HR
    if (isOffline) {
      const lastOnlineLog = await LocationLog.findOne({
        user: userId,
        isOffline: false,
      })
        .sort({ timestamp: -1 })
        .lean();

      if (lastOnlineLog) {
        const offlineDurationMs =
          Date.now() - new Date(lastOnlineLog.timestamp).getTime();
        const offlineDurationHours = offlineDurationMs / (1000 * 60 * 60);

        // Alert if offline for >= 1 hour
        if (offlineDurationHours >= 1) {
          const description = `User offline for ${offlineDurationHours.toFixed(
            2
          )} hours`;

          await Alert.create({
            user: userId,
            type: "offline_long",
            description,
          });

          if (process.env.HR_WHATSAPP_TO) {
            await sendWhatsAppAlert(
              process.env.HR_WHATSAPP_TO,
              `Offline alert: ${description}`
            );
          }
        }
      }
    }

    // Device / GPS / Internet alerts pushed from mobile app
    const alertPromises: Promise<unknown>[] = [];
    const alertDescriptions: string[] = [];

    if (gpsDisabled) {
      alertDescriptions.push("GPS disabled on device");
      alertPromises.push(
        Alert.create({
          user: userId,
          type: "gps_disabled",
          description: "GPS disabled on device",
        })
      );
    }

    if (internetDisabled) {
      alertDescriptions.push("Internet disabled on device");
      alertPromises.push(
        Alert.create({
          user: userId,
          type: "internet_disabled",
          description: "Internet disabled on device",
        })
      );
    }

    if (deviceOff) {
      alertDescriptions.push("Device switched off");
      alertPromises.push(
        Alert.create({
          user: userId,
          type: "device_off",
          description: "Device switched off",
        })
      );
    }

    if (alertPromises.length > 0) {
      await Promise.all(alertPromises);

      if (process.env.HR_WHATSAPP_TO) {
        await sendWhatsAppAlert(
          process.env.HR_WHATSAPP_TO,
          `Alert(s) for user ${userId}: ${alertDescriptions.join(", ")}`
        );
      }
    }

    res.json({ message: "Location logged" });
  } catch (error) {
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