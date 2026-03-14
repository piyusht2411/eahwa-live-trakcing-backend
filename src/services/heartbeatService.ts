import User from "../models/user";
import Punch from "../models/punch";
import Break from "../models/break";
import Alert from "../models/alert";
import { updatePunchSheet } from "./googleSheetsService";
import { sendFCMNotification, sendWhatsAppAlert } from "./notificationService";

export const checkHeartbeats = async () => {
  try {
    const THRESHOLD_MINUTES = 2;
    const cutoffTime = new Date(Date.now() - THRESHOLD_MINUTES * 60 * 1000);

    // Find users whose last location update was before the cutoff time
    const staleUsers = await User.find({
      lastLocationAt: { $lt: cutoffTime, $ne: null },
      role: { $in: ["employee", "manager"] } // Only check employees and managers
    }).populate("managedBy");

    let autoPunchedOutCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of staleUsers) {
      // 1. Check if user is currently punched in today
      const lastPunch = await Punch.findOne({ user: user._id, date: { $gte: today } }).sort({ time: -1 });
      
      if (!lastPunch || lastPunch.type !== "in") {
        continue; // Not punched in or already punched out
      }

      // 2. Check if user is currently on an active break
      const activeBreak = await Break.findOne({ user: user._id, endTime: { $exists: false } });
      if (activeBreak) {
        continue; // User is on a valid break, ignore silence
      }

      // 3. User is punched in, not on break, and hasn't sent location for 20 mins. AUTO PUNCH OUT.
      const now = new Date();
      const autoPunch = new Punch({
        user: user._id,
        type: "out",
        date: now,
        time: now,
        // Use last known location from the in-punch since we don't have current
        location: lastPunch.location, 
        isAutomatic: true,
        reason: "Location sharing stopped",
        selfie: null, // No selfie for auto punch-out
      });

      await autoPunch.save();

      // 4. Create Alert
      await Alert.create({
        user: user._id,
        type: "location_stopped",
        description: `User stopped sharing location for over ${THRESHOLD_MINUTES} minutes`,
      });

      // 5. Update Google Sheet
      try {
        const manager: any = user.managedBy;
        await updatePunchSheet({
          employeeName: user.name,
          employeeId: user.employeeId,
          department: user.department,
          manager: manager?.name || "N/A",
          date: autoPunch.date,
          time: autoPunch.time,
          location: autoPunch.location,
          selfie: null, // handled as "N/A" in googleSheetsService update
          type: "Auto Punch-Out (Location Stopped)",
        });
      } catch (sheetError) {
        console.error("Failed to update Google Sheet for auto punch-out:", sheetError);
      }

      // 6. Notify Admins
      autoPunchedOutCount++;
      const admins = await User.find({ role: "admin", fcmToken: { $ne: null } });
      const fcmTokens = admins.map(a => a.fcmToken as string).filter(Boolean);
      
      const title = "⚠️ Location Sharing Stopped";
      const body = `${user.name} stopped sending location and was auto punched out.`;

      for (const token of fcmTokens) {
        try {
          await sendFCMNotification(token, title, body);
        } catch (fcmError) {
          console.error("Failed to send FCM for auto punch-out:", fcmError);
        }
      }
      
      // WhatsApp to HR if configured
      if (process.env.HR_WHATSAPP_TO) {
        try {
          await sendWhatsAppAlert(process.env.HR_WHATSAPP_TO, `*Alert*: ${body}`);
        } catch (waError) {
          console.error("Failed to send WA alert:", waError);
        }
      }
    }

    return { success: true, processed: autoPunchedOutCount };
  } catch (error) {
    console.error("Error checking heartbeats:", error);
    throw error;
  }
};
