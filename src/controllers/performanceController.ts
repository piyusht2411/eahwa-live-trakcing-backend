import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Performance from "../models/performance";

export const getPerformances = async (req: Request, res: Response) => {
    try {
        const { period = "daily" } = req.query; // daily, weekly, monthly

        let startDate = new Date();
        if (period === "daily") {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === "weekly") {
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            startDate = new Date(startDate.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
        } else if (period === "monthly") {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        }

        const performances = await Performance.find({
            period,
            periodStart: { $gte: startDate }
        })
        .populate("user", "name employeeId department profilePicture")
        .sort({ score: -1, createdAt: -1 })
        .lean();

        res.status(200).json({
            success: true,
            data: performances
        });

    } catch (error) {
        console.error("Get performances error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
