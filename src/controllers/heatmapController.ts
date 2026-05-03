import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Task from "../models/task";
import User from "../models/user";
import { haversineDistance } from "../utils/healper";

// Two showroom visits are considered the "same location" if within 200 m
const CLUSTER_RADIUS_METERS = 200;

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitRecord {
    employeeId: string;
    employeeName: string;
    date: string;          // "YYYY-MM-DD"
    showroomName: string;
    address: string;
}

interface Cluster {
    lat: number;
    lng: number;
    pointCount: number;    // for running-average center
    address: string;
    showroomName: string;
    visits: VisitRecord[];
    // per-employee aggregation built at mapping time
    employeeMap: Map<string, { name: string; visitDates: string[]; visitCount: number }>;
}

// ── Controller ────────────────────────────────────────────────────────────────

export const getHeatmapData = async (req: AuthRequest, res: Response) => {
    try {
        const { period = "today" } = req.query;

        // ── Date range ───────────────────────────────────────────────────────
        const now = new Date();
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        if (period === "week") {
            startDate.setDate(now.getDate() - 7);
        } else if (period === "month") {
            startDate.setMonth(now.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
        }

        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        // ── Role-based user scoping ──────────────────────────────────────────
        const authUser = req.user!;
        const adminRoles = ["admin", "super_manager", "hr"];
        const isAdminLevel = adminRoles.includes(authUser.role);

        let scopedUserIds: string[] | null = null;
        if (!isAdminLevel) {
            // manager: only their direct reports
            const team = await User.find({ managedBy: authUser._id, isActive: true })
                .select("_id")
                .lean();
            scopedUserIds = team.map((u: any) => u._id.toString());
        }

        // ── Fetch tasks (= actual visits) ────────────────────────────────────
        const taskQuery: any = {
            date: { $gte: startDate, $lte: endDate },
            "address.lat": { $exists: true, $ne: null },
            "address.lng": { $exists: true, $ne: null },
        };
        if (scopedUserIds) {
            taskQuery.user = { $in: scopedUserIds };
        }

        const tasks = await Task.find(taskQuery)
            .populate("user", "name employeeId")
            .lean();

        // ── Greedy spatial clustering ────────────────────────────────────────
        const clusters: Cluster[] = [];

        for (const task of tasks) {
            const user: any = task.user;
            if (!user) continue;

            const lat = task.address?.lat;
            const lng = task.address?.lng;
            if (!lat || !lng) continue;

            const dateStr = new Date(task.date).toISOString().split("T")[0];

            const visit: VisitRecord = {
                employeeId:   user.employeeId || user._id.toString(),
                employeeName: user.name        || "Unknown",
                date:         dateStr,
                showroomName: task.showroomName || "",
                address:      task.address?.fullAddress || "",
            };

            // Find nearest cluster within radius
            let nearest: Cluster | null = null;
            let minDist = Infinity;

            for (const c of clusters) {
                const distM = haversineDistance(c.lat, c.lng, lat, lng) * 1000;
                if (distM <= CLUSTER_RADIUS_METERS && distM < minDist) {
                    minDist = distM;
                    nearest = c;
                }
            }

            if (nearest) {
                // Update running-average center
                nearest.pointCount++;
                nearest.lat = (nearest.lat * (nearest.pointCount - 1) + lat) / nearest.pointCount;
                nearest.lng = (nearest.lng * (nearest.pointCount - 1) + lng) / nearest.pointCount;

                // Prefer a non-empty address / showroomName
                if (!nearest.address && visit.address) nearest.address = visit.address;
                if (!nearest.showroomName && visit.showroomName) nearest.showroomName = visit.showroomName;

                nearest.visits.push(visit);

                // Update per-employee map
                const emp = nearest.employeeMap.get(visit.employeeId);
                if (emp) {
                    emp.visitCount++;
                    if (!emp.visitDates.includes(visit.date)) emp.visitDates.push(visit.date);
                } else {
                    nearest.employeeMap.set(visit.employeeId, {
                        name:       visit.employeeName,
                        visitCount: 1,
                        visitDates: [visit.date],
                    });
                }
            } else {
                // Start a new cluster
                const empMap = new Map<string, { name: string; visitDates: string[]; visitCount: number }>();
                empMap.set(visit.employeeId, { name: visit.employeeName, visitCount: 1, visitDates: [dateStr] });

                clusters.push({
                    lat,
                    lng,
                    pointCount:  1,
                    address:     visit.address,
                    showroomName: visit.showroomName,
                    visits:      [visit],
                    employeeMap: empMap,
                });
            }
        }

        // ── Format response ──────────────────────────────────────────────────
        const heatmapData = clusters
            .filter(c => c.visits.length >= 1)
            .sort((a, b) => b.visits.length - a.visits.length) // hottest first
            .map(cluster => {
                const totalVisits = cluster.visits.length;

                // Per-employee breakdown: sorted by most visits first
                const employees = Array.from(cluster.employeeMap.entries())
                    .map(([empId, info]) => ({
                        employeeId:  empId,
                        name:        info.name,
                        visitCount:  info.visitCount,
                        visitDates:  info.visitDates.sort(), // chronological
                    }))
                    .sort((a, b) => b.visitCount - a.visitCount);

                // Flat visit log: chronological, useful for a detail panel
                const visitLog = cluster.visits
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(v => ({
                        date:         v.date,
                        employeeId:   v.employeeId,
                        employeeName: v.employeeName,
                        showroomName: v.showroomName,
                        address:      v.address,
                    }));

                // Heat level
                let coverage: "High" | "Medium" | "Low" = "Low";
                let color = "bg-blue-100 text-blue-700 border-blue-200";
                if (totalVisits >= 20) {
                    coverage = "High";
                    color    = "bg-red-100 text-red-700 border-red-200";
                } else if (totalVisits >= 8) {
                    coverage = "Medium";
                    color    = "bg-orange-100 text-orange-700 border-orange-200";
                }

                return {
                    lat:            parseFloat(cluster.lat.toFixed(6)),
                    lng:            parseFloat(cluster.lng.toFixed(6)),
                    address:        cluster.address  || null,
                    showroomName:   cluster.showroomName || null,
                    totalVisits,
                    uniqueVisitors: cluster.employeeMap.size,
                    coverage,
                    color,
                    employees,   // who visits + how many times + which dates
                    visitLog,    // flat chronological list of every visit
                };
            });

        res.status(200).json({
            success: true,
            period,
            data: heatmapData,
        });

    } catch (error) {
        console.error("Heatmap data error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
