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
exports.getTodayBreaks = exports.getAllBreaks = exports.endBreak = exports.startBreak = void 0;
const break_1 = __importDefault(require("../models/break"));
const startBreak = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    try {
        // Check if a break is already active
        const activeBreak = yield break_1.default.findOne({ user: userId, endTime: { $exists: false } });
        if (activeBreak) {
            return res.status(400).json({ success: false, message: "A break is already active" });
        }
        const newBreak = new break_1.default({
            user: userId,
            startTime: new Date(),
            type: "start",
        });
        yield newBreak.save();
        res.status(201).json({
            success: true,
            message: "Break started successfully",
            data: newBreak,
        });
    }
    catch (error) {
        console.error("Start break error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.startBreak = startBreak;
const endBreak = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    try {
        // Find the active break
        const activeBreak = yield break_1.default.findOne({ user: userId, endTime: { $exists: false } });
        if (!activeBreak) {
            return res.status(404).json({ success: false, message: "No active break found to end" });
        }
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - new Date(activeBreak.startTime).getTime()) / 60000); // duration in minutes
        activeBreak.endTime = endTime;
        activeBreak.type = "end";
        activeBreak.duration = duration;
        yield activeBreak.save();
        res.status(200).json({
            success: true,
            message: "Break ended successfully",
            data: activeBreak,
        });
    }
    catch (error) {
        console.error("End break error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.endBreak = endBreak;
const getAllBreaks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { date, month } = req.query;
    try {
        let query = {};
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.startTime = { $gte: start, $lte: end };
        }
        else if (month) {
            const [year, mon] = month.split("-").map(Number);
            query.startTime = { $gte: new Date(year, mon - 1, 1), $lte: new Date(year, mon, 0, 23, 59, 59, 999) };
        }
        const breaks = yield break_1.default.find(query)
            .populate({ path: "user", select: "name managedBy", populate: { path: "managedBy", select: "name" } })
            .sort({ startTime: -1 })
            .lean();
        const now = Date.now();
        const data = breaks.map((b) => {
            var _a;
            const user = b.user || {};
            const manager = user.managedBy || {};
            const runningMins = !b.endTime
                ? Math.round((now - new Date(b.startTime).getTime()) / 60000)
                : 0;
            let status;
            if (b.endTime)
                status = "ended";
            else if (runningMins > 30)
                status = "overdue";
            else
                status = "active";
            return {
                _id: b._id,
                employeeName: user.name || "Unknown",
                managerName: manager.name || "Unknown",
                date: new Date(b.startTime).toISOString().split("T")[0],
                breakStart: b.startTime,
                breakEnd: b.endTime || null,
                duration: (_a = b.duration) !== null && _a !== void 0 ? _a : runningMins,
                location: "",
                status,
            };
        });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        console.error("Get all breaks error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllBreaks = getAllBreaks;
const getTodayBreaks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const breaks = yield break_1.default.find({
            user: userId,
            startTime: { $gte: today }
        }).sort({ startTime: 1 });
        const totalBreakMinutes = breaks.reduce((total, brk) => total + (brk.duration || 0), 0);
        const activeBreak = breaks.find(b => !b.endTime) || null;
        res.status(200).json({
            success: true,
            data: {
                breaks,
                activeBreak,
                totalBreakMinutes,
                breaksTaken: breaks.length,
            }
        });
    }
    catch (error) {
        console.error("Get breaks error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTodayBreaks = getTodayBreaks;
