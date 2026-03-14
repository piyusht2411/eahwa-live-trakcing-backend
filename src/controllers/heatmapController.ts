import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Geofence from "../models/geofence";
import Task from "../models/task";
import User from "../models/user";
import { haversineDistance } from "../utils/healper";

export const getHeatmapData = async (req: AuthRequest, res: Response) => {
    try {
        const { period = "today" } = req.query;

        const now = new Date();
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        if (period === "week") {
            startDate.setDate(now.getDate() - 7);
        } else if (period === "month") {
            startDate.setMonth(now.getMonth() - 1);
        }

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        // 1. Fetch Active Geofences
        const geofences = await Geofence.find({ isActive: true }).lean();

        // 2. Fetch Tasks for the period
        const tasks = await Task.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate("user", "name").lean();

        // 3. Process Heatmap Data
        const heatmapData = geofences.map(zone => {
            const zoneTasks = tasks.filter(task => {
                if (!task.address?.lat || !task.address?.lng) return false;
                // haversineDistance returns distance in km, radius is in meters
                const distance = haversineDistance(
                    zone.center.lat,
                    zone.center.lng,
                    task.address.lat,
                    task.address.lng
                );
                return distance * 1000 <= zone.radius;
            });

            // Group by employee
            const employeeVisitsMap = new Map<string, { name: string, visits: number }>();
            zoneTasks.forEach(task => {
                const user: any = task.user;
                if (!user) return;
                
                const userId = user._id.toString();
                const existing = employeeVisitsMap.get(userId);
                if (existing) {
                    existing.visits += 1;
                } else {
                    employeeVisitsMap.set(userId, { name: user.name, visits: 1 });
                }
            });

            const employees = Array.from(employeeVisitsMap.values())
                .sort((a, b) => b.visits - a.visits);

            const totalVisits = zoneTasks.length;

            // Determine Coverage and Color
            let coverage = "Low";
            let color = "bg-blue-100 text-blue-700 border-blue-200";

            if (totalVisits >= 30) {
                coverage = "High";
                color = "bg-red-100 text-red-700 border-red-200";
            } else if (totalVisits >= 10) {
                coverage = "Medium";
                color = "bg-orange-100 text-orange-700 border-orange-200";
            }

            return {
                name: zone.name,
                totalVisits,
                coverage,
                mapPosition: [zone.center.lat, zone.center.lng],
                employees,
                color
            };
        });

        res.status(200).json({
            success: true,
            data: heatmapData
        });

    } catch (error) {
        console.error("Heatmap data error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
