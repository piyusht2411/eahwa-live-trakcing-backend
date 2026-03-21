import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Performance from "../models/performance";
import Punch from "../models/punch";
import Task from "../models/task";
import LocationLog from "../models/locationlogs";
import { calculateScore } from "../services/performanceService";
import { getRoadDistance } from "../utils/healper";

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Try to get today's performance, or calculate it if it doesn't exist
        let performance = await Performance.findOne({
            user: userId,
            period: "daily",
            periodStart: today
        });

        if (!performance) {
            performance = await calculateScore(userId, "daily", today, endOfDay);
        }

        // Get today's tasks
        const tasks = await Task.find({
            user: userId,
            date: { $gte: today, $lte: endOfDay }
        });

        // Get today's punches
        const punches = await Punch.find({
            user: userId,
            date: { $gte: today, $lte: endOfDay }
        }).sort({ time: 1 });

        // Calculate distance from today's location logs (live)
        const locationLogs = await LocationLog.find({
            user: userId,
            timestamp: { $gte: today, $lte: endOfDay }
        }).sort({ timestamp: 1 }).select("location").lean();

        const coords = locationLogs.map(l => ({ lat: l.location.lat, lng: l.location.lng }));
        const distanceTraveled = await getRoadDistance(coords);

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
    } catch (error) {
        console.error("Get dashboard stats error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
