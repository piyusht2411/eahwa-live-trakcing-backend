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
        const { month } = req.query; // YYYY-MM
        let startDate;
        let endDate;
        if (month && typeof month === "string") {
            const [yearStr, monthStr] = month.split("-");
            const year = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10) - 1; // 0-indexed month
            startDate = new Date(year, m, 1);
            endDate = new Date(year, m + 1, 0, 23, 59, 59, 999);
        }
        else {
            // Default to current month
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        const attendanceRecords = yield punch_1.default.find({
            date: { $gte: startDate, $lte: endDate }
        })
            .populate("user", "name employeeId department")
            .sort({ date: -1, time: -1 })
            .lean();
        // The data can be aggregated by date and user if needed, but returning a raw list is also fine
        // depending on the exact admin needs. Returning plain records for now.
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
