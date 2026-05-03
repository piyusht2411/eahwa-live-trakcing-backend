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
exports.getHeatmapData = void 0;
const task_1 = __importDefault(require("../models/task"));
const user_1 = __importDefault(require("../models/user"));
const healper_1 = require("../utils/healper");
// Two showroom visits are considered the "same location" if within 200 m
const CLUSTER_RADIUS_METERS = 200;
// ── Controller ────────────────────────────────────────────────────────────────
const getHeatmapData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { period = "today" } = req.query;
        // ── Date range ───────────────────────────────────────────────────────
        const now = new Date();
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        if (period === "week") {
            startDate.setDate(now.getDate() - 7);
        }
        else if (period === "month") {
            startDate.setMonth(now.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
        }
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        // ── Role-based user scoping ──────────────────────────────────────────
        const authUser = req.user;
        const adminRoles = ["admin", "super_manager", "hr"];
        const isAdminLevel = adminRoles.includes(authUser.role);
        let scopedUserIds = null;
        if (!isAdminLevel) {
            // manager: only their direct reports
            const team = yield user_1.default.find({ managedBy: authUser._id, isActive: true })
                .select("_id")
                .lean();
            scopedUserIds = team.map((u) => u._id.toString());
        }
        // ── Fetch tasks (= actual visits) ────────────────────────────────────
        const taskQuery = {
            date: { $gte: startDate, $lte: endDate },
            "address.lat": { $exists: true, $ne: null },
            "address.lng": { $exists: true, $ne: null },
        };
        if (scopedUserIds) {
            taskQuery.user = { $in: scopedUserIds };
        }
        const tasks = yield task_1.default.find(taskQuery)
            .populate("user", "name employeeId")
            .lean();
        // ── Greedy spatial clustering ────────────────────────────────────────
        const clusters = [];
        for (const task of tasks) {
            const user = task.user;
            if (!user)
                continue;
            const lat = (_a = task.address) === null || _a === void 0 ? void 0 : _a.lat;
            const lng = (_b = task.address) === null || _b === void 0 ? void 0 : _b.lng;
            if (!lat || !lng)
                continue;
            const dateStr = new Date(task.date).toISOString().split("T")[0];
            const visit = {
                employeeId: user.employeeId || user._id.toString(),
                employeeName: user.name || "Unknown",
                date: dateStr,
                showroomName: task.showroomName || "",
                address: ((_c = task.address) === null || _c === void 0 ? void 0 : _c.fullAddress) || "",
            };
            // Find nearest cluster within radius
            let nearest = null;
            let minDist = Infinity;
            for (const c of clusters) {
                const distM = (0, healper_1.haversineDistance)(c.lat, c.lng, lat, lng) * 1000;
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
                if (!nearest.address && visit.address)
                    nearest.address = visit.address;
                if (!nearest.showroomName && visit.showroomName)
                    nearest.showroomName = visit.showroomName;
                nearest.visits.push(visit);
                // Update per-employee map
                const emp = nearest.employeeMap.get(visit.employeeId);
                if (emp) {
                    emp.visitCount++;
                    if (!emp.visitDates.includes(visit.date))
                        emp.visitDates.push(visit.date);
                }
                else {
                    nearest.employeeMap.set(visit.employeeId, {
                        name: visit.employeeName,
                        visitCount: 1,
                        visitDates: [visit.date],
                    });
                }
            }
            else {
                // Start a new cluster
                const empMap = new Map();
                empMap.set(visit.employeeId, { name: visit.employeeName, visitCount: 1, visitDates: [dateStr] });
                clusters.push({
                    lat,
                    lng,
                    pointCount: 1,
                    address: visit.address,
                    showroomName: visit.showroomName,
                    visits: [visit],
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
                employeeId: empId,
                name: info.name,
                visitCount: info.visitCount,
                visitDates: info.visitDates.sort(), // chronological
            }))
                .sort((a, b) => b.visitCount - a.visitCount);
            // Flat visit log: chronological, useful for a detail panel
            const visitLog = cluster.visits
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(v => ({
                date: v.date,
                employeeId: v.employeeId,
                employeeName: v.employeeName,
                showroomName: v.showroomName,
                address: v.address,
            }));
            // Heat level
            let coverage = "Low";
            let color = "bg-blue-100 text-blue-700 border-blue-200";
            if (totalVisits >= 20) {
                coverage = "High";
                color = "bg-red-100 text-red-700 border-red-200";
            }
            else if (totalVisits >= 8) {
                coverage = "Medium";
                color = "bg-orange-100 text-orange-700 border-orange-200";
            }
            return {
                lat: parseFloat(cluster.lat.toFixed(6)),
                lng: parseFloat(cluster.lng.toFixed(6)),
                address: cluster.address || null,
                showroomName: cluster.showroomName || null,
                totalVisits,
                uniqueVisitors: cluster.employeeMap.size,
                coverage,
                color,
                employees, // who visits + how many times + which dates
                visitLog, // flat chronological list of every visit
            };
        });
        res.status(200).json({
            success: true,
            period,
            data: heatmapData,
        });
    }
    catch (error) {
        console.error("Heatmap data error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getHeatmapData = getHeatmapData;
