import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Punch from "../models/punch";

export const getAttendance = async (req: Request, res: Response) => {
    try {
        const { date } = req.query; // Expected format: YYYY-MM-DD (single day filter)
        let startDate: Date;
        let endDate: Date;

        if (date && typeof date === "string") {
            // Parse YYYY-MM-DD for a specific day
            const [yearStr, monthStr, dayStr] = date.split("-");
            const year = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10) - 1; // 0-indexed month
            const d = parseInt(dayStr, 10);

            startDate = new Date(year, m, d);                    // 00:00:00
            endDate = new Date(year, m, d, 23, 59, 59, 999);     // 23:59:59.999
        } else {
            // No filter applied → return ONLY today's attendance
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const day = now.getDate();

            startDate = new Date(year, month, day);                    // 00:00:00 today
            endDate = new Date(year, month, day, 23, 59, 59, 999);     // 23:59:59.999 today
        }

        const attendanceRecords = await Punch.find({
            date: { $gte: startDate, $lte: endDate }
        })
            .populate("user", "name employeeId department")
            .sort({ date: -1, time: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: attendanceRecords
        });
    } catch (error) {
        console.error("Get attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
