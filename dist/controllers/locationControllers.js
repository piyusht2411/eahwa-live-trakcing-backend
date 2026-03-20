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
exports.getTodayLocationHistory = exports.checkHomeIdleUsers = exports.getHeatMap = exports.getLiveTrack = exports.logLocation = void 0;
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const user_1 = __importDefault(require("../models/user"));
const alert_1 = __importDefault(require("../models/alert"));
const punch_1 = __importDefault(require("../models/punch"));
const anomalyService_1 = require("../services/anomalyService");
const mongoose_1 = require("mongoose");
const socket_1 = require("../socket");
const notificationService_1 = require("../services/notificationService");
const logLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { location, speed, battery, isOffline, gpsDisabled, internetDisabled, deviceOff, } = req.body;
    const userId = req.user._id;
    try {
        // Skip logging if user has not punched in today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latestPunch = yield punch_1.default.findOne({ user: userId, date: { $gte: today } })
            .sort({ time: -1 })
            .lean();
        if (!latestPunch || latestPunch.type === "out") {
            return res.json({ message: "Not punched in, location not logged" });
        }
        const parsedLocation = typeof location === "string" ? JSON.parse(location) : location;
        const log = new locationlogs_1.default({
            user: userId,
            location: parsedLocation,
            speed,
            battery,
            isOffline,
        });
        yield log.save();
        yield user_1.default.findByIdAndUpdate(userId, { lastLocationAt: new Date() });
        yield (0, anomalyService_1.detectAnomalies)(userId, log);
        // Emit real-time location to any watchers
        (0, socket_1.getIO)().to(`location:${userId}`).emit("location:update", {
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
        const alertPromises = [];
        const alertDescriptions = [];
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
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error" });
    }
});
exports.logLocation = logLocation;
const getLiveTrack = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    try {
        // Hierarchy check in middleware
        const logs = yield locationlogs_1.default.find({ user: userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate("user", "name");
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ message: "Error" });
    }
});
exports.getLiveTrack = getLiveTrack;
const getHeatMap = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { start, end } = req.query;
    const authUser = req.user;
    const authUserId = authUser._id;
    try {
        const timeQuery = {
            timestamp: {
                $gte: new Date(start),
                $lte: new Date(end),
            },
        };
        // For admin/HR: full map; for manager: only team; for employee: self only
        if (authUser.role === "manager") {
            const team = yield user_1.default.find({ managedBy: authUserId }).select("_id");
            timeQuery.user = { $in: team.map((u) => u._id) };
        }
        else if (authUser.role === "employee") {
            timeQuery.user = authUserId;
        }
        const logs = yield locationlogs_1.default.aggregate([
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
    }
    catch (error) {
        res.status(500).json({ message: "Error" });
    }
});
exports.getHeatMap = getHeatMap;
// Haversine distance in km between two lat/lng points
const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
// Called by cron job (cron-job.org) every 30 min between 9 AM – 1 PM
// Checks: user punched in 30+ min ago but all location logs still within 100m of home
const checkHomeIdleUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const HOME_RADIUS_KM = 0.1; // 100 metres
    const IDLE_MINUTES = 30;
    try {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000);
        // Find all punch-ins today that happened at least 30 min ago
        const punchIns = yield punch_1.default.find({
            type: "in",
            date: { $gte: today },
            time: { $lte: cutoff },
        })
            .populate("user", "name homeLocation role")
            .lean();
        const alerted = [];
        for (const punch of punchIns) {
            const user = punch.user;
            if (!((_a = user === null || user === void 0 ? void 0 : user.homeLocation) === null || _a === void 0 ? void 0 : _a.lat) || !((_b = user === null || user === void 0 ? void 0 : user.homeLocation) === null || _b === void 0 ? void 0 : _b.lng))
                continue;
            // Skip if we already sent this alert today
            const existingAlert = yield alert_1.default.findOne({
                user: user._id,
                type: "no_movement",
                timestamp: { $gte: today },
            }).lean();
            if (existingAlert)
                continue;
            // Get all location logs since punch-in
            const logs = yield locationlogs_1.default.find({
                user: user._id,
                timestamp: { $gte: new Date(punch.time) },
            }).lean();
            if (logs.length === 0)
                continue;
            // Check if every log is within 100m of home
            const allAtHome = logs.every((log) => haversineKm(user.homeLocation.lat, user.homeLocation.lng, log.location.lat, log.location.lng) <= HOME_RADIUS_KM);
            if (!allAtHome)
                continue;
            // Create alert
            const description = `${user.name} punched in ${IDLE_MINUTES}+ min ago but has not moved from home location`;
            yield alert_1.default.create({ user: user._id, type: "no_movement", description });
            // Notify HR (fire-and-forget)
            if (process.env.HR_WHATSAPP_TO) {
                (0, notificationService_1.sendAnomalyAlert)(String(user._id), user.name, "no_movement", description).catch((err) => console.error("Home-idle WhatsApp alert failed:", err.message));
            }
            alerted.push(user.name);
        }
        res.json({ checked: punchIns.length, alerted });
    }
    catch (error) {
        console.error("checkHomeIdleUsers error:", error);
        res.status(500).json({ message: "Error" });
    }
});
exports.checkHomeIdleUsers = checkHomeIdleUsers;
const getTodayLocationHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        // Validate ObjectId
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        }
        // Calculate today (00:00:00 to 23:59:59)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const logs = yield locationlogs_1.default.find({
            user: userId,
            timestamp: { $gte: today, $lt: tomorrow }, // ← Today only
        })
            .select("location timestamp speed battery") // Only fields needed for map
            .sort({ timestamp: 1 }) // ← Oldest to newest (perfect for polyline)
            .lean();
        res.status(200).json({
            success: true,
            data: logs,
            totalPoints: logs.length,
            date: today.toISOString().split("T")[0],
        });
    }
    catch (error) {
        console.error("Today location history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTodayLocationHistory = getTodayLocationHistory;
