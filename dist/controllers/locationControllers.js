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
exports.getTodayLocationHistory = exports.getHeatMap = exports.getLiveTrack = exports.logLocation = void 0;
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const user_1 = __importDefault(require("../models/user"));
const alert_1 = __importDefault(require("../models/alert"));
const anomalyService_1 = require("../services/anomalyService");
const notificationService_1 = require("../services/notificationService");
const mongoose_1 = require("mongoose");
const logLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { location, speed, battery, isOffline, gpsDisabled, internetDisabled, deviceOff, } = req.body;
    const userId = req.user._id;
    try {
        const parsedLocation = typeof location === "string" ? JSON.parse(location) : location;
        const log = new locationlogs_1.default({
            user: userId,
            location: parsedLocation,
            speed,
            battery,
            isOffline,
        });
        yield log.save();
        // Update user's tracking timestamp for heartbeat cron
        yield user_1.default.findByIdAndUpdate(userId, { lastLocationAt: new Date() });
        // Detect anomalies on each location log
        yield (0, anomalyService_1.detectAnomalies)(userId, log);
        // Offline tracking: log long offline durations and alert HR
        if (isOffline) {
            const lastOnlineLog = yield locationlogs_1.default.findOne({
                user: userId,
                isOffline: false,
            })
                .sort({ timestamp: -1 })
                .lean();
            if (lastOnlineLog) {
                const offlineDurationMs = Date.now() - new Date(lastOnlineLog.timestamp).getTime();
                const offlineDurationHours = offlineDurationMs / (1000 * 60 * 60);
                // Alert if offline for >= 1 hour
                if (offlineDurationHours >= 1) {
                    const description = `User offline for ${offlineDurationHours.toFixed(2)} hours`;
                    yield alert_1.default.create({
                        user: userId,
                        type: "offline_long",
                        description,
                    });
                    if (process.env.HR_WHATSAPP_TO) {
                        yield (0, notificationService_1.sendWhatsAppAlert)(process.env.HR_WHATSAPP_TO, `Offline alert: ${description}`);
                    }
                }
            }
        }
        // Device / GPS / Internet alerts pushed from mobile app
        const alertPromises = [];
        const alertDescriptions = [];
        if (gpsDisabled) {
            alertDescriptions.push("GPS disabled on device");
            alertPromises.push(alert_1.default.create({
                user: userId,
                type: "gps_disabled",
                description: "GPS disabled on device",
            }));
        }
        if (internetDisabled) {
            alertDescriptions.push("Internet disabled on device");
            alertPromises.push(alert_1.default.create({
                user: userId,
                type: "internet_disabled",
                description: "Internet disabled on device",
            }));
        }
        if (deviceOff) {
            alertDescriptions.push("Device switched off");
            alertPromises.push(alert_1.default.create({
                user: userId,
                type: "device_off",
                description: "Device switched off",
            }));
        }
        if (alertPromises.length > 0) {
            yield Promise.all(alertPromises);
            if (process.env.HR_WHATSAPP_TO) {
                yield (0, notificationService_1.sendWhatsAppAlert)(process.env.HR_WHATSAPP_TO, `Alert(s) for user ${userId}: ${alertDescriptions.join(", ")}`);
            }
        }
        res.json({ message: "Location logged" });
    }
    catch (error) {
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
