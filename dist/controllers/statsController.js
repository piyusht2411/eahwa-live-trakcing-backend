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
exports.getDashboardStats = void 0;
const performance_1 = __importDefault(require("../models/performance"));
const punch_1 = __importDefault(require("../models/punch"));
const task_1 = __importDefault(require("../models/task"));
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const performanceService_1 = require("../services/performanceService");
const healper_1 = require("../utils/healper");
const getDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        // Try to get today's performance, or calculate it if it doesn't exist
        let performance = yield performance_1.default.findOne({
            user: userId,
            period: "daily",
            periodStart: today
        });
        if (!performance) {
            performance = yield (0, performanceService_1.calculateScore)(userId, "daily", today, endOfDay);
        }
        // Get today's tasks
        const tasks = yield task_1.default.find({
            user: userId,
            date: { $gte: today, $lte: endOfDay }
        });
        // Get today's punches
        const punches = yield punch_1.default.find({
            user: userId,
            date: { $gte: today, $lte: endOfDay }
        }).sort({ time: 1 });
        // Calculate distance from today's location logs (live)
        const locationLogs = yield locationlogs_1.default.find({
            user: userId,
            timestamp: { $gte: today, $lte: endOfDay }
        }).sort({ timestamp: 1 }).select("location").lean();
        let distanceTraveled = 0;
        for (let i = 1; i < locationLogs.length; i++) {
            distanceTraveled += (0, healper_1.haversineDistance)(locationLogs[i - 1].location.lat, locationLogs[i - 1].location.lng, locationLogs[i].location.lat, locationLogs[i].location.lng);
        }
        distanceTraveled = parseFloat(distanceTraveled.toFixed(2));
        // Calculate basic hours worked from punches
        let hoursWorked = 0;
        if (punches.length > 0) {
            let firstIn = punches.find(p => p.type === "in");
            let lastOut = [...punches].reverse().find(p => p.type === "out");
            if (firstIn) {
                const endTime = lastOut ? lastOut.time.getTime() : new Date().getTime();
                hoursWorked = (endTime - firstIn.time.getTime()) / (1000 * 60 * 60);
            }
        }
        res.status(200).json({
            success: true,
            data: {
                score: performance.score,
                distanceTraveled,
                hoursWorked: hoursWorked ? parseFloat(hoursWorked.toFixed(2)) : 0,
                tasksCompleted: tasks.length,
                punchesToday: punches.length
            },
        });
    }
    catch (error) {
        console.error("Get dashboard stats error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getDashboardStats = getDashboardStats;
