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
const geofence_1 = __importDefault(require("../models/geofence"));
const task_1 = __importDefault(require("../models/task"));
const healper_1 = require("../utils/healper");
const getHeatmapData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { period = "today" } = req.query;
        const now = new Date();
        let startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        if (period === "week") {
            startDate.setDate(now.getDate() - 7);
        }
        else if (period === "month") {
            startDate.setMonth(now.getMonth() - 1);
        }
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        // 1. Fetch Active Geofences
        const geofences = yield geofence_1.default.find({ isActive: true }).lean();
        // 2. Fetch Tasks for the period
        const tasks = yield task_1.default.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate("user", "name").lean();
        // 3. Process Heatmap Data
        const heatmapData = geofences.map(zone => {
            const zoneTasks = tasks.filter(task => {
                var _a, _b;
                if (!((_a = task.address) === null || _a === void 0 ? void 0 : _a.lat) || !((_b = task.address) === null || _b === void 0 ? void 0 : _b.lng))
                    return false;
                // haversineDistance returns distance in km, radius is in meters
                const distance = (0, healper_1.haversineDistance)(zone.center.lat, zone.center.lng, task.address.lat, task.address.lng);
                return distance * 1000 <= zone.radius;
            });
            // Group by employee
            const employeeVisitsMap = new Map();
            zoneTasks.forEach(task => {
                const user = task.user;
                if (!user)
                    return;
                const userId = user._id.toString();
                const existing = employeeVisitsMap.get(userId);
                if (existing) {
                    existing.visits += 1;
                }
                else {
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
            }
            else if (totalVisits >= 10) {
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
    }
    catch (error) {
        console.error("Heatmap data error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getHeatmapData = getHeatmapData;
