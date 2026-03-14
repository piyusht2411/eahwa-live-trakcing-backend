import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Punch from "../models/punch";

export const getAttendance = async (req: Request, res: Response) => {
    try {
        const { month } = req.query; // YYYY-MM
        let startDate: Date;
        let endDate: Date;

        if (month && typeof month === "string") {
            const [yearStr, monthStr] = month.split("-");
            const year = parseInt(yearStr, 10);
            const m = parseInt(monthStr, 10) - 1; // 0-indexed month
            startDate = new Date(year, m, 1);
            endDate = new Date(year, m + 1, 0, 23, 59, 59, 999);
        } else {
            // Default to current month
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        const attendanceRecords = await Punch.find({
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
    } catch (error) {
        console.error("Get attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
