import User from "../models/user";
import Punch from "../models/punch";
import Break from "../models/break";
import Alert from "../models/alert";
import LocationLog from "../models/locationlogs";
import { sendFCMNotification, sendLocationStoppedAlert } from "./notificationService";

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const checkHeartbeats = async () => {
  try {
    const THRESHOLD_MINUTES = 20;
    const cutoffTime = new Date(Date.now() - THRESHOLD_MINUTES * 60 * 1000);

    const staleUsers = await User.find({
      lastLocationAt: { $lt: cutoffTime, $ne: null },
      role: { $in: ["employee", "manager"] },
    });

    let alertedCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of staleUsers) {
      // 1. Must be currently punched in today
      const lastPunch = await Punch.findOne({
        user: user._id,
        date: { $gte: today },
      }).sort({ time: -1 });

      if (!lastPunch || lastPunch.type !== "in") continue;

      // 2. Skip if on an active break
      const activeBreak = await Break.findOne({
        user: user._id,
        endTime: { $exists: false },
      });
      if (activeBreak) continue;

      // 3. Create alert
      await Alert.create({
        user: user._id,
        type: "location_stopped",
        description: `User stopped sharing location for over ${THRESHOLD_MINUTES} minutes`,
      });

      alertedCount++;

      // 4. FCM → all admins
      const admins = await User.find({ role: "admin", fcmToken: { $ne: null } });

      for (const admin of admins) {
        if (!admin.fcmToken) continue;
        try {
          await sendFCMNotification(
            admin.fcmToken,
            "⚠️ Location Sharing Stopped",
            `${user.name} stopped sending location for over ${THRESHOLD_MINUTES} minutes.`
          );
        } catch (fcmError) {
          console.error(`FCM failed for admin ${admin._id}:`, fcmError);
        }
      }

      // 5. WhatsApp → HR via template
      if (process.env.HR_WHATSAPP_TO) {
        try {
          await sendLocationStoppedAlert(
            String(user._id),
            user.name,         // {{1}}
            THRESHOLD_MINUTES  // {{2}}
          );
        } catch (waError) {
          console.error(`WhatsApp alert failed for user ${user._id}:`, waError);
        }
      }
    }

    return { success: true, alerted: alertedCount };
  } catch (error) {
    console.error("Error checking heartbeats:", error);
    throw error;
  }
};

// ── Long Stationary Alert ─────────────────────────────────────────────────────
// Detects employees who ARE actively sharing location but haven't moved from
// a spot for IDLE_MINUTES. Fires a no_movement alert (same type as home-idle-check)
// with a 2-hour cooldown to prevent spam.
export const checkLongStationary = async () => {
  try {
    const IDLE_MINUTES = 60;
    const ALERT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // re-alert at most once per 2h

    const cutoffTime = new Date(Date.now() - IDLE_MINUTES * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Only users who ARE actively sharing location (lastLocationAt is fresh)
    const activeUsers = await User.find({
      lastLocationAt: { $gte: cutoffTime },
      role: { $in: ["employee", "manager"] },
    });

    let alertedCount = 0;

    for (const user of activeUsers) {
      // Must be punched in
      const lastPunch = await Punch.findOne({
        user: user._id,
        date: { $gte: today },
      }).sort({ time: -1 });
      if (!lastPunch || lastPunch.type !== "in") continue;

      // Skip if on an active break
      const activeBreak = await Break.findOne({
        user: user._id,
        endTime: { $exists: false },
      });
      if (activeBreak) continue;

      // Find the user's most recent actual location log today.
      // Stationary heartbeats do NOT create LocationLog entries (backend deduplicates
      // by distance), so if the last real log is older than IDLE_MINUTES the user
      // has been at the same spot for that long — even though lastLocationAt is fresh
      // (kept alive by heartbeats).
      const lastLog = await LocationLog.findOne({
        user: user._id,
        timestamp: { $gte: today },
      })
        .sort({ timestamp: -1 })
        .select("timestamp")
        .lean();

      if (!lastLog) continue; // no logs today yet

      const timeSinceLastMovement =
        Date.now() - new Date((lastLog as any).timestamp).getTime();
      if (timeSinceLastMovement < IDLE_MINUTES * 60 * 1000) continue; // moved recently

      // Cooldown: skip if already alerted in the last 2 hours
      const recentAlert = await Alert.findOne({
        user: user._id,
        type: "no_movement",
        timestamp: { $gte: new Date(Date.now() - ALERT_COOLDOWN_MS) },
      });
      if (recentAlert) continue;

      // Create alert
      await Alert.create({
        user: user._id,
        type: "no_movement",
        description: `User has not moved from their location for over ${IDLE_MINUTES} minutes while punched in`,
      });
      alertedCount++;

      // Notify all admins via FCM
      const admins = await User.find({ role: "admin", fcmToken: { $ne: null } });
      for (const admin of admins) {
        if (!admin.fcmToken) continue;
        try {
          await sendFCMNotification(
            admin.fcmToken,
            "⚠️ Employee Not Moving",
            `${user.name} has been at the same location for over ${IDLE_MINUTES} minutes.`
          );
        } catch (fcmError) {
          console.error(`FCM failed for admin ${admin._id}:`, fcmError);
        }
      }
    }

    return { success: true, alerted: alertedCount };
  } catch (error) {
    console.error("Error checking long stationary:", error);
    throw error;
  }
};