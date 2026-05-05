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
const punchCheck_1 = require("../utils/punchCheck");
const accessScope_1 = require("../utils/accessScope");
const startBreak = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    const { location } = req.body; // ← Expected from mobile app
    if (!location || !location.lat || !location.lng) {
        return res.status(400).json({
            success: false,
            message: "Location is required to start a break"
        });
    }
    // Check if user is punched in
    const punchedIn = yield (0, punchCheck_1.isUserPunchedIn)(userId);
    if (!punchedIn) {
        return res.status(403).json({
            success: false,
            message: "You must be punched in to start a break"
        });
    }
    try {
        const activeBreak = yield break_1.default.findOne({ user: userId, endTime: { $exists: false } });
        if (activeBreak) {
            return res.status(400).json({ success: false, message: "A break is already active" });
        }
        const newBreak = new break_1.default({
            user: userId,
            startTime: new Date(),
            startLocation: location, // ← Saved
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
    const { location } = req.body; // ← Optional but recommended
    try {
        const activeBreak = yield break_1.default.findOne({ user: userId, endTime: { $exists: false } });
        if (!activeBreak) {
            return res.status(404).json({ success: false, message: "No active break found to end" });
        }
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - new Date(activeBreak.startTime).getTime()) / 60000);
        activeBreak.endTime = endTime;
        activeBreak.type = "end";
        activeBreak.duration = duration;
        // ← Save end location if provided
        if ((location === null || location === void 0 ? void 0 : location.lat) && (location === null || location === void 0 ? void 0 : location.lng)) {
            activeBreak.endLocation = location;
        }
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
    try {
        // ────────────────────────────────────────────────
        //               Query Parameters
        // ────────────────────────────────────────────────
        const { page = "1", limit = "20", startDate, // YYYY-MM-DD
        endDate, // YYYY-MM-DD
        status, // "active" | "ended" | "overdue" | "all" (default: all)
        search, // employee name partial search
        month, // fallback if no date range → "2025-03"
         } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;
        // ────────────────────────────────────────────────
        //                Build MongoDB Query
        // ────────────────────────────────────────────────
        const query = {};
        const allowedUserIds = yield (0, accessScope_1.getManagedUserIdsForScope)(req.user);
        if (allowedUserIds !== null) {
            query.user = { $in: allowedUserIds };
        }
        // 1. Date range filter (preferred over month)
        if (startDate || endDate) {
            query.startTime = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.startTime.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.startTime.$lte = end;
            }
        }
        // Fallback: month filter (e.g. "2025-03")
        else if (month) {
            const [year, mon] = month.split("-").map(Number);
            if (!isNaN(year) && !isNaN(mon)) {
                query.startTime = {
                    $gte: new Date(year, mon - 1, 1),
                    $lte: new Date(year, mon, 0, 23, 59, 59, 999),
                };
            }
        }
        // 2. Search by employee name (requires population → we'll use $lookup or post-filter)
        //    → easiest is to populate first and filter in JS for small/medium datasets
        //    → for large scale → use aggregation with $lookup + $match
        // 3. Status filter (active/ended/overdue)
        const now = new Date();
        if (status && status !== "all") {
            if (status === "active") {
                query.endTime = { $exists: false };
            }
            else if (status === "ended") {
                query.endTime = { $exists: true };
            }
            else if (status === "overdue") {
                // running breaks longer than 30 minutes
                query.endTime = { $exists: false };
                // We'll calculate running time later — can't do >30min directly in query
                // → we'll filter in JS after fetch
            }
        }
        // ────────────────────────────────────────────────
        //              Fetch Breaks with Pagination
        // ────────────────────────────────────────────────
        const breaks = yield break_1.default.find(query)
            .populate({
            path: "user",
            select: "name managedBy",
            populate: {
                path: "managedBy",
                select: "name",
            },
        })
            .sort({ startTime: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();
        // ────────────────────────────────────────────────
        //       Post-processing + status calculation
        // ────────────────────────────────────────────────
        const enrichedBreaks = breaks
            .map((b) => {
            var _a;
            const user = b.user || {};
            const manager = user.managedBy || {};
            const start = new Date(b.startTime);
            const isEnded = !!b.endTime;
            let runningMinutes = 0;
            if (!isEnded) {
                runningMinutes = Math.round((now.getTime() - start.getTime()) / 60000);
            }
            let breakStatus;
            if (isEnded) {
                breakStatus = "ended";
            }
            else if (runningMinutes > 30) {
                breakStatus = "overdue";
            }
            else {
                breakStatus = "active";
            }
            return {
                _id: b._id,
                employeeName: user.name || "Unknown",
                managerName: manager.name || "Unknown",
                date: start.toISOString().split("T")[0],
                breakStart: b.startTime,
                breakEnd: b.endTime || null,
                duration: (_a = b.duration) !== null && _a !== void 0 ? _a : runningMinutes,
                status: breakStatus,
                startLocation: b.startLocation || null,
                endLocation: b.endLocation || null,
            };
        })
            // Optional: filter by status in memory if "overdue" was requested
            .filter((b) => {
            if (status === "overdue")
                return b.status === "overdue";
            return true;
        });
        // ────────────────────────────────────────────────
        //             Optional: name search in memory
        // ────────────────────────────────────────────────
        let finalData = enrichedBreaks;
        if (search && typeof search === "string" && search.trim()) {
            const searchLower = search.trim().toLowerCase();
            finalData = enrichedBreaks.filter((b) => b.employeeName.toLowerCase().includes(searchLower));
        }
        // ────────────────────────────────────────────────
        //                   Pagination Meta
        // ────────────────────────────────────────────────
        const total = yield break_1.default.countDocuments(query); // Note: doesn't include post-filters
        res.status(200).json({
            success: true,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
                hasNext: pageNum * limitNum < total,
                hasPrev: pageNum > 1,
            },
            data: finalData,
        });
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
                breaks, // ← Now each break has startLocation & endLocation
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
