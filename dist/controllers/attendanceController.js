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
exports.getAttendance = void 0;
const punch_1 = __importDefault(require("../models/punch"));
const getAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date } = req.query; // Expected format: YYYY-MM-DD (single day filter)
        let startDate;
        let endDate;
        if (date && typeof date === "string") {
            // Parse YYYY-MM-DD for a specific day
            const [yearStr, monthStr, dayStr] = date.split("-");
            const year = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10) - 1; // 0-indexed month
            const d = parseInt(dayStr, 10);
            startDate = new Date(year, m, d); // 00:00:00
            endDate = new Date(year, m, d, 23, 59, 59, 999); // 23:59:59.999
        }
        else {
            // No filter applied → return ONLY today's attendance
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const day = now.getDate();
            startDate = new Date(year, month, day); // 00:00:00 today
            endDate = new Date(year, month, day, 23, 59, 59, 999); // 23:59:59.999 today
        }
        const attendanceRecords = yield punch_1.default.find({
            date: { $gte: startDate, $lte: endDate }
        })
            .populate("user", "name employeeId department")
            .sort({ date: -1, time: -1 })
            .lean();
        res.status(200).json({
            success: true,
            data: attendanceRecords
        });
    }
    catch (error) {
        console.error("Get attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAttendance = getAttendance;
