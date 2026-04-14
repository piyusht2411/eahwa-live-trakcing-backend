// src/services/anomalyService.ts
import LocationLog from "../models/locationlogs";
import Punch from "../models/punch";
import Anomaly from "../models/anomaly";
import User from "../models/user";
import { sendAnomalyAlert } from "./notificationService";

// ── Helper: resolve employee name once per detectAnomalies call ───────────────
const resolveEmployeeName = async (userId: string): Promise<string> => {
  const user = await User.findById(userId).lean();
  return (user as any)?.name ?? userId;
};

// ── Helper: save anomaly + optionally fire WhatsApp alert ─────────────────────
const logAnomaly = async (
  userId: string,
  employeeName: string,
  type: string,
  description: string,
  notify = false
) => {
  await Anomaly.create({ user: userId, type, description });

  if (notify && process.env.HR_WHATSAPP_TO) {
    sendAnomalyAlert(userId, employeeName, type, description).catch((err) =>
      console.error("Anomaly WhatsApp alert failed:", err.message)
    );
  }
};

// ── Speed helper ──────────────────────────────────────────────────────────────
const calculateSpeed = (log1: any, log2: any): number => {
  const R = 6371; // Earth radius km
  const dLat = ((log1.location.lat - log2.location.lat) * Math.PI) / 180;
  const dLon = ((log1.location.lng - log2.location.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((log2.location.lat * Math.PI) / 180) *
      Math.cos((log1.location.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const deltaHours =
    Math.abs(
      new Date(log1.timestamp).getTime() - new Date(log2.timestamp).getTime()
    ) /
    (1000 * 60 * 60);

  return deltaHours > 0 ? distanceKm / deltaHours : 0;
};

// ── Main ──────────────────────────────────────────────────────────────────────
export const detectAnomalies = async (userId: string, log: any) => {
  // Anomaly detection only applies to users actively working as ASM (field mode).
  // Office employees and dual-role users in office mode are excluded.
  const userRecord = await User.findById(userId).select("activeMode").lean();
  if (!userRecord || (userRecord as any).activeMode !== "asm") return;

  const [recentLogs, recentPunches, employeeName] = await Promise.all([
    LocationLog.find({ user: userId }).sort({ timestamp: -1 }).limit(10),
    Punch.find({ user: userId }).sort({ time: -1 }).limit(5),
    resolveEmployeeName(userId),
  ]);

  // ── Repeated punch at same location ────────────────────────────────────────
  if (
    recentPunches.length > 1 &&
    recentPunches[0].type === "in" &&
    recentPunches[0].location.lat === recentPunches[1].location.lat &&
    recentPunches[0].location.lng === recentPunches[1].location.lng
  ) {
    // Dedup: only alert once per day — this check runs on every location ping
    // so without a guard it fires every ~1 minute for the entire day.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyLogged = await Anomaly.findOne({
      user: userId,
      type: "repeated_punch",
      createdAt: { $gte: todayStart },
    }).lean();

    if (!alreadyLogged) {
      await logAnomaly(
        userId,
        employeeName,
        "repeated_punch",
        "Punch-in detected from the same location twice",
        true
      );
    }
  }

  // ── Unrealistic speed ───────────────────────────────────────────────────────
  if (recentLogs.length > 1) {
    // Prefer device-reported speed (Doppler-based, unaffected by GPS jitter).
    // Coordinate-based speed is unreliable for stationary devices because GPS
    // drift can make a motionless phone appear to have jumped hundreds of metres.
    let speedKmh: number;
    if (log.speed != null) {
      speedKmh = log.speed * 3.6; // m/s → km/h
    } else {
      const R = 6371;
      const lat1 = recentLogs[0].location.lat;
      const lng1 = recentLogs[0].location.lng;
      const lat2 = recentLogs[1].location.lat;
      const lng2 = recentLogs[1].location.lng;
      const dLat = ((lat1 - lat2) * Math.PI) / 180;
      const dLon = ((lng1 - lng2) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat2 * Math.PI) / 180) *
          Math.cos((lat1 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const distKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      // Skip if distance is within GPS noise range — avoids jitter false positives
      if (distKm < 0.5) {
        speedKmh = 0;
      } else {
        speedKmh = calculateSpeed(recentLogs[0], recentLogs[1]);
      }
    }

    if (speedKmh > 200) {
      await logAnomaly(
        userId,
        employeeName,
        "unrealistic_speed",
        `Speed of ${speedKmh.toFixed(1)} km/h detected between last two locations`,
        true  // notify HR
      );
    }
  }

  // ── Excessive idle (no new log for 1 hour within today) ────────────────────
  // Only compare against logs from today. Without the date check, the first log
  // of every morning would always trigger this (gap from yesterday's last log).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = recentLogs.filter(
    (l) => new Date(l.timestamp).getTime() >= today.getTime()
  );
  if (
    todayLogs.length > 0 &&
    Date.now() - new Date(todayLogs[0].timestamp).getTime() > 3_600_000
  ) {
    await logAnomaly(
      userId,
      employeeName,
      "excessive_idle",
      "No movement or location update detected for over 1 hour",
      true  // notify HR
    );
  }
};