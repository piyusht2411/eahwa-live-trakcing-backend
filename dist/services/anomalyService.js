"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAnomalies = void 0;
// src/services/anomalyService.ts
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const punch_1 = __importDefault(require("../models/punch"));
const anomaly_1 = __importDefault(require("../models/anomaly"));
const user_1 = __importDefault(require("../models/user"));
const notificationService_1 = require("./notificationService");
// ── Helper: resolve employee name once per detectAnomalies call ───────────────
const resolveEmployeeName = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield user_1.default.findById(userId).lean();
    return (_a = user === null || user === void 0 ? void 0 : user.name) !== null && _a !== void 0 ? _a : userId;
});
// ── Helper: save anomaly + optionally fire WhatsApp alert ─────────────────────
const logAnomaly = (userId_1, employeeName_1, type_1, description_1, ...args_1) => __awaiter(void 0, [userId_1, employeeName_1, type_1, description_1, ...args_1], void 0, function* (userId, employeeName, type, description, notify = false) {
    yield anomaly_1.default.create({ user: userId, type, description });
    if (notify && process.env.HR_WHATSAPP_TO) {
        (0, notificationService_1.sendAnomalyAlert)(userId, employeeName, type, description).catch((err) => console.error("Anomaly WhatsApp alert failed:", err.message));
    }
});
// ── Speed helper ──────────────────────────────────────────────────────────────
const calculateSpeed = (log1, log2) => {
    const R = 6371; // Earth radius km
    const dLat = ((log1.location.lat - log2.location.lat) * Math.PI) / 180;
    const dLon = ((log1.location.lng - log2.location.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((log2.location.lat * Math.PI) / 180) *
            Math.cos((log1.location.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    const distanceKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const deltaHours = Math.abs(new Date(log1.timestamp).getTime() - new Date(log2.timestamp).getTime()) /
        (1000 * 60 * 60);
    return deltaHours > 0 ? distanceKm / deltaHours : 0;
};
// ── Main ──────────────────────────────────────────────────────────────────────
const detectAnomalies = (userId, log) => __awaiter(void 0, void 0, void 0, function* () {
    // Anomaly detection only applies to users actively working as ASM (field mode).
    // Office employees and dual-role users in office mode are excluded.
    const userRecord = yield user_1.default.findById(userId).select("activeMode").lean();
    if (!userRecord || userRecord.activeMode !== "asm")
        return;
    const [recentLogs, recentPunches, employeeName] = yield Promise.all([
        locationlogs_1.default.find({ user: userId }).sort({ timestamp: -1 }).limit(10),
        punch_1.default.find({ user: userId }).sort({ time: -1 }).limit(5),
        resolveEmployeeName(userId),
    ]);
    // ── Repeated punch at same location ────────────────────────────────────────
    // if (
    //   recentPunches.length > 1 &&
    //   recentPunches[0].type === "in" &&
    //   recentPunches[0].location.lat === recentPunches[1].location.lat &&
    //   recentPunches[0].location.lng === recentPunches[1].location.lng
    // ) {
    //   // Dedup: only alert once per day — this check runs on every location ping
    //   // so without a guard it fires every ~1 minute for the entire day.
    //   const todayStart = new Date();
    //   todayStart.setHours(0, 0, 0, 0);
    //   const alreadyLogged = await Anomaly.findOne({
    //     user: userId,
    //     type: "repeated_punch",
    //     createdAt: { $gte: todayStart },
    //   }).lean();
    //   if (!alreadyLogged) {
    //     await logAnomaly(
    //       userId,
    //       employeeName,
    //       "repeated_punch",
    //       "Punch-in detected from the same location twice",
    //       true
    //     );
    //   }
    // }
    // ── Unrealistic speed ───────────────────────────────────────────────────────
    if (recentLogs.length > 1) {
        // Prefer device-reported speed (Doppler-based, unaffected by GPS jitter).
        // Coordinate-based speed is unreliable for stationary devices because GPS
        // drift can make a motionless phone appear to have jumped hundreds of metres.
        let speedKmh;
        if (log.speed != null) {
            speedKmh = log.speed * 3.6; // m/s → km/h
        }
        else {
            const R = 6371;
            const lat1 = recentLogs[0].location.lat;
            const lng1 = recentLogs[0].location.lng;
            const lat2 = recentLogs[1].location.lat;
            const lng2 = recentLogs[1].location.lng;
            const dLat = ((lat1 - lat2) * Math.PI) / 180;
            const dLon = ((lng1 - lng2) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos((lat2 * Math.PI) / 180) *
                    Math.cos((lat1 * Math.PI) / 180) *
                    Math.sin(dLon / 2) ** 2;
            const distKm = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            // Skip if distance is within GPS noise range — avoids jitter false positives
            if (distKm < 0.5) {
                speedKmh = 0;
            }
            else {
                speedKmh = calculateSpeed(recentLogs[0], recentLogs[1]);
            }
        }
        if (speedKmh > 200) {
            yield logAnomaly(userId, employeeName, "unrealistic_speed", `Speed of ${speedKmh.toFixed(1)} km/h detected between last two locations`, true // notify HR
            );
        }
    }
    // ── Excessive idle (no new log for 1 hour within today) ────────────────────
    // Only compare against logs from today. Without the date check, the first log
    // of every morning would always trigger this (gap from yesterday's last log).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = recentLogs.filter((l) => new Date(l.timestamp).getTime() >= today.getTime());
    if (todayLogs.length > 0 &&
        Date.now() - new Date(todayLogs[0].timestamp).getTime() > 3600000) {
        yield logAnomaly(userId, employeeName, "excessive_idle", "No movement or location update detected for over 1 hour", true // notify HR
        );
    }
});
exports.detectAnomalies = detectAnomalies;
