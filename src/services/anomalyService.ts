// src/services/anomalyService.ts
import LocationLog from "../models/locationlogs";
import Punch from "../models/punch";
import Anomaly from "../models/anomaly";
import { sendWhatsAppAlert } from "./notificationService";

export const detectAnomalies = async (userId: string, log: any) => {
  const recentLogs = await LocationLog.find({ user: userId }).sort({ timestamp: -1 }).limit(10);
  const recentPunches = await Punch.find({ user: userId }).sort({ time: -1 }).limit(5);

  // Repeated punch
  if (recentPunches.length > 1 && recentPunches[0].location.lat === recentPunches[1].location.lat && recentPunches[0].type === "in") {
    await logAnomaly(userId, "repeated_punch", "Same location punch detected");
  }

  // Unrealistic speed
  if (recentLogs.length > 1) {
    const speed = calculateSpeed(recentLogs[0], recentLogs[1]);
    if (speed > 200) { // km/h
      await logAnomaly(userId, "unrealistic_speed", `Speed: ${speed} km/h`);
    }
  }

  // Excessive idle
  if (recentLogs.length > 1 && (Date.now() - recentLogs[0].timestamp.getTime()) > 3600000) { // 1hr
    await logAnomaly(userId, "excessive_idle", "No movement for 1 hour");
    await sendWhatsAppAlert("hr_phone", "Idle alert for employee");
  }

  // Short visit (from tasks, assume integrated)
};

const logAnomaly = async (userId: string, type: string, desc: string) => {
  const anomaly = new Anomaly({ user: userId, type, description: desc });
  await anomaly.save();
};

const calculateSpeed = (log1: any, log2: any) => {
  // Implement
  return 0;
};