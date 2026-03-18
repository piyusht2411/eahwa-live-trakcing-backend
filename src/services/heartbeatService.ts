import User from "../models/user";
import Punch from "../models/punch";
import Break from "../models/break";
import Alert from "../models/alert";
import { sendFCMNotification, sendLocationStoppedAlert } from "./notificationService";

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