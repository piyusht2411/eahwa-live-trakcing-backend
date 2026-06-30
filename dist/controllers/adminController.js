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
exports.getEmployeeStock = exports.getEmployeeWeeklyHours = exports.getEmployeePerformance = exports.closeOpenSessions = exports.autoPunchOut = exports.getInactiveUsers = exports.getEmployeeStats = exports.getLocationHistory = exports.getLiveLocations = exports.getAdminDashboardStats = void 0;
const user_1 = __importDefault(require("../models/user"));
const punch_1 = __importDefault(require("../models/punch"));
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const alert_1 = __importDefault(require("../models/alert"));
const performance_1 = __importDefault(require("../models/performance"));
const task_1 = __importDefault(require("../models/task"));
const break_1 = __importDefault(require("../models/break"));
const healper_1 = require("../utils/healper");
const accessScope_1 = require("../utils/accessScope");
const persistTravelDistance_1 = require("../utils/persistTravelDistance");
const getAdminDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const period = req.query.period || "today";
        const role = req.user.role;
        // ── Role-based scoping ───────────────────────────────────────────────
        // manager  → only their managed employees
        // super_manager / hr / admin → all employees (scopedIds = null)
        let scopedIds = null;
        if (role === "manager") {
            const managedUsers = yield user_1.default.find({ managedBy: req.user._id, isActive: true })
                .select("_id")
                .lean();
            scopedIds = managedUsers.map((u) => u._id);
        }
        // Helper: add user filter to a query object only when scoped
        const withScope = (q = {}) => scopedIds ? Object.assign(Object.assign({}, q), { user: { $in: scopedIds } }) : q;
        // Derive period date range
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setHours(23, 59, 59, 999);
        let periodStart = new Date(now);
        if (period === "week") {
            const dayOfWeek = periodStart.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            periodStart.setDate(periodStart.getDate() - diffToMonday);
        }
        else if (period === "month") {
            periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        periodStart.setHours(0, 0, 0, 0);
        // Today boundaries (activeNow is always real-time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        // 1. Total Employees (scoped)
        const employeeBaseQuery = { role: "employee", isActive: true };
        if (scopedIds)
            employeeBaseQuery._id = { $in: scopedIds };
        const totalEmployees = yield user_1.default.countDocuments(employeeBaseQuery);
        // 2. Active Now (always today-based, scoped)
        const punchesToday = yield punch_1.default.find(withScope({ date: { $gte: today, $lte: endOfDay } })).sort({ time: 1 });
        const userPunchStatus = new Map();
        punchesToday.forEach(punch => {
            userPunchStatus.set(punch.user.toString(), punch.type);
        });
        let activeNowCount = 0;
        Array.from(userPunchStatus.values()).forEach(status => {
            if (status === "in")
                activeNowCount++;
        });
        // 3. Punctuality (period-based, scoped)
        const punchesInPeriod = period === "today"
            ? punchesToday
            : yield punch_1.default.find(withScope({ date: { $gte: periodStart, $lte: periodEnd } })).sort({ time: 1 });
        const firstPunches = new Map();
        punchesInPeriod.forEach(punch => {
            if (punch.type === "in") {
                const dateStr = punch.time.toISOString().split("T")[0];
                const key = `${punch.user}-${dateStr}`;
                const existing = firstPunches.get(key);
                if (!existing || punch.time < existing) {
                    firstPunches.set(key, punch.time);
                }
            }
        });
        let onTimeCount = 0;
        let lateCount = 0;
        firstPunches.forEach(time => {
            const h = time.getHours(), m = time.getMinutes();
            if (h < 9 || (h === 9 && m <= 30))
                onTimeCount++;
            else
                lateCount++;
        });
        const punctuality = [
            { name: "On Time", value: onTimeCount },
            { name: "Late", value: lateCount },
        ];
        // 4. Recent Anomalies (period-based, scoped)
        const anomalyQuery = {
            resolved: false,
            timestamp: { $gte: periodStart, $lte: periodEnd },
        };
        if (scopedIds)
            anomalyQuery.user = { $in: scopedIds };
        const recentAnomalies = yield alert_1.default.find(anomalyQuery)
            .populate("user", "name employeeId")
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();
        const formattedAnomalies = recentAnomalies.map(a => {
            var _a;
            return ({
                id: a._id,
                employee: ((_a = a.user) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
                type: a.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
                timestamp: a.timestamp,
                severity: ["no_movement", "gps_disabled", "device_off"].includes(a.type) ? "High" : "Medium",
                status: a.resolved ? "Resolved" : "Active",
                description: a.description,
            });
        });
        // 5. Top Performers (scoped by managed users when manager)
        const perfMatch = {
            period: "daily",
            periodStart: { $gte: periodStart, $lte: periodEnd },
        };
        if (scopedIds)
            perfMatch.user = { $in: scopedIds };
        const topPerfsAgg = yield performance_1.default.aggregate([
            { $match: perfMatch },
            { $group: { _id: "$user", totalScore: { $sum: "$score" }, days: { $sum: 1 } } },
            { $addFields: { avgScore: { $divide: ["$totalScore", "$days"] } } },
            { $sort: { avgScore: -1 } },
            { $limit: 5 },
        ]);
        const perfUserIds = topPerfsAgg.map(p => p._id);
        const perfUsers = yield user_1.default.find({ _id: { $in: perfUserIds } }).select("name department").lean();
        const perfUserMap = new Map(perfUsers.map((u) => [u._id.toString(), u]));
        const topPerformers = topPerfsAgg.map(p => {
            const user = perfUserMap.get(p._id.toString()) || {};
            return {
                name: user.name || "Unknown",
                department: user.department || "Unknown",
                score: Math.round(p.avgScore * 10) / 10,
            };
        });
        res.status(200).json({
            success: true,
            data: {
                period,
                totalEmployees,
                activeNow: activeNowCount,
                punctuality,
                recentAnomalies: formattedAnomalies,
                topPerformers,
            },
        });
    }
    catch (error) {
        console.error("Admin dashboard error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAdminDashboardStats = getAdminDashboardStats;
const getLiveLocations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allowedUserIds = yield (0, accessScope_1.getManagedUserIdsForScope)(req.user);
        const match = { timestamp: { $gte: today } };
        if (allowedUserIds !== null) {
            if (allowedUserIds.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }
            match.user = { $in: allowedUserIds };
        }
        // Get the most recent location log for each user today
        const liveLocations = yield locationlogs_1.default.aggregate([
            { $match: match },
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$user",
                    logId: { $first: "$_id" },
                    location: { $first: "$location" },
                    speed: { $first: "$speed" },
                    battery: { $first: "$battery" },
                    isOffline: { $first: "$isOffline" },
                    timestamp: { $first: "$timestamp" }
                }
            }
        ]);
        // Populate user details manually since aggregate doesn't run middleware
        const userIds = liveLocations.map(l => l._id);
        const users = yield user_1.default.find({ _id: { $in: userIds } }).select("name employeeId department mapColor");
        const userMap = new Map();
        users.forEach((u) => userMap.set(u._id.toString(), u));
        const formattedLocations = liveLocations.map(loc => {
            const user = userMap.get(loc._id.toString());
            return {
                id: (user === null || user === void 0 ? void 0 : user.employeeId) || loc._id.toString(),
                userId: loc._id,
                name: (user === null || user === void 0 ? void 0 : user.name) || "Unknown",
                department: (user === null || user === void 0 ? void 0 : user.department) || "Unassigned",
                latitude: loc.location.lat,
                longitude: loc.location.lng,
                lastUpdate: loc.timestamp,
                battery: loc.battery,
                speed: loc.speed != null ? parseFloat(loc.speed.toFixed(1)) : null,
                status: loc.isOffline ? "offline" : "online",
                mapColor: (user === null || user === void 0 ? void 0 : user.mapColor) || "#2196F3",
            };
        });
        res.status(200).json({
            success: true,
            data: formattedLocations
        });
    }
    catch (error) {
        console.error("Get live locations error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLiveLocations = getLiveLocations;
const getLocationHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const { date } = req.query; // YYYY-MM-DD
        let startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        let endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        if (date && typeof date === "string") {
            startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
        }
        const UserObj = yield user_1.default.findById(userId).select("name employeeId");
        if (!UserObj) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        // Fetch all logs for the user on that date, sorted sequentially
        const logs = yield locationlogs_1.default.find({
            user: userId,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 }).lean();
        // Fetch tasks for this user on this date to match showroom info
        const tasks = yield task_1.default.find({
            user: userId,
            date: { $gte: startOfDay, $lte: endOfDay }
        }).lean();
        // Pre-compute road-based distances for all consecutive log segments
        const logCoords = logs.map(l => ({ lat: l.location.lat, lng: l.location.lng, timestamp: l.timestamp }));
        const segmentDistances = yield (0, healper_1.getRoadSegmentDistances)(logCoords);
        const route = logs.map((log, i) => {
            var _a, _b;
            let showroomName = "";
            let location = "";
            // Find nearest task within 200m (proximity check — keep haversine)
            for (const task of tasks) {
                if (((_a = task.address) === null || _a === void 0 ? void 0 : _a.lat) && ((_b = task.address) === null || _b === void 0 ? void 0 : _b.lng)) {
                    const dist = (0, healper_1.haversineDistance)(log.location.lat, log.location.lng, task.address.lat, task.address.lng);
                    if (dist <= 0.2) {
                        showroomName = task.showroomName;
                        location = task.address.fullAddress || "";
                        break;
                    }
                }
            }
            // Road-based distance from previous point (km)
            const distance = i > 0 ? parseFloat(segmentDistances[i - 1].toFixed(2)) : 0;
            // Time spent: minutes until next log point
            const timeSpent = i < logs.length - 1
                ? Math.round((new Date(logs[i + 1].timestamp).getTime() - new Date(log.timestamp).getTime()) / 60000)
                : 0;
            return {
                lat: log.location.lat,
                lng: log.location.lng,
                timestamp: log.timestamp,
                speed: log.speed,
                showroomName,
                location,
                distance,
                timeSpent,
            };
        });
        res.status(200).json({
            success: true,
            data: {
                employee: {
                    id: UserObj._id,
                    name: UserObj.name,
                    employeeId: UserObj.employeeId
                },
                date: startOfDay.toISOString().split("T")[0],
                route
            }
        });
    }
    catch (error) {
        console.error("Get location history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLocationHistory = getLocationHistory;
const getEmployeeStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const { userId } = req.params;
        const { date } = req.query;
        let targetDate = new Date();
        targetDate.setHours(0, 0, 0, 0);
        let endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        if (date && typeof date === "string") {
            targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);
            endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
        }
        const UserObj = yield user_1.default.findById(userId).select("name employeeId");
        if (!UserObj) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        let performance = yield performance_1.default.findOne({
            user: userId,
            period: "daily",
            periodStart: targetDate
        });
        let score = (performance === null || performance === void 0 ? void 0 : performance.score) || 0;
        // ── Distance: 3-tier fallback so it never goes zero after LocationLog TTL ──
        // Tier 1: Performance.metrics.distanceKm  (written by punch-out, forward-compat)
        // Tier 2: Performance.metrics.distance    (legacy field, may be a ratio — use if > 1 km as heuristic)
        // Tier 3: User.travelHistory              (always written on every punch-out)
        let distanceTraveled = (_b = (_a = performance === null || performance === void 0 ? void 0 : performance.metrics) === null || _a === void 0 ? void 0 : _a.distanceKm) !== null && _b !== void 0 ? _b : 0;
        if (!distanceTraveled && ((_c = performance === null || performance === void 0 ? void 0 : performance.metrics) === null || _c === void 0 ? void 0 : _c.distance) && performance.metrics.distance > 1) {
            // Legacy field stored absolute km (not a 0-1 ratio)
            distanceTraveled = performance.metrics.distance;
        }
        if (!distanceTraveled) {
            // Fallback: read from User.travelHistory
            const userWithHistory = yield user_1.default.findById(userId)
                .select("travelHistory")
                .lean();
            const historyEntry = ((_d = userWithHistory === null || userWithHistory === void 0 ? void 0 : userWithHistory.travelHistory) !== null && _d !== void 0 ? _d : []).find((h) => new Date(h.date).toDateString() === targetDate.toDateString());
            distanceTraveled = (_e = historyEntry === null || historyEntry === void 0 ? void 0 : historyEntry.distanceKm) !== null && _e !== void 0 ? _e : 0;
        }
        const tasks = yield task_1.default.countDocuments({
            user: userId,
            date: { $gte: targetDate, $lte: endOfDay }
        });
        const punches = yield punch_1.default.find({
            user: userId,
            date: { $gte: targetDate, $lte: endOfDay }
        }).sort({ time: 1 });
        let hoursWorked = 0;
        if (punches.length > 0) {
            let firstIn = punches.find(p => p.type === "in");
            let lastOut = [...punches].reverse().find(p => p.type === "out");
            if (firstIn) {
                const endTime = lastOut ? lastOut.time.getTime() : new Date().getTime();
                hoursWorked = (endTime - firstIn.time.getTime()) / (1000 * 60 * 60);
                if (hoursWorked < 0 || hoursWorked > 24)
                    hoursWorked = 0;
            }
        }
        res.status(200).json({
            success: true,
            data: {
                employee: {
                    id: UserObj._id,
                    name: UserObj.name,
                    employeeId: UserObj.employeeId
                },
                date: targetDate.toISOString().split('T')[0],
                score,
                distanceTraveled,
                hoursWorked: parseFloat(hoursWorked.toFixed(2)),
                tasksCompleted: tasks,
                punchesDay: punches.length
            }
        });
    }
    catch (error) {
        console.error("Get specific employee stats error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getEmployeeStats = getEmployeeStats;
const INACTIVE_THRESHOLD_MINUTES = 30;
// Shared helper: find employees who are punched in but stopped sending location
const findInactiveEmployees = () => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 1. Get all today's punches, find who is currently punched in
    const punchesToday = yield punch_1.default.find({ date: { $gte: today } }).sort({ time: 1 }).lean();
    const userPunchMap = new Map();
    for (const p of punchesToday) {
        const uid = p.user.toString();
        const existing = userPunchMap.get(uid);
        if (!existing || p.time > existing.punchInTime) {
            userPunchMap.set(uid, {
                lastType: p.type,
                punchInTime: (existing === null || existing === void 0 ? void 0 : existing.lastType) === "in" ? existing.punchInTime : p.time,
            });
        }
    }
    const allPunchedInIds = Array.from(userPunchMap.entries())
        .filter(([, v]) => v.lastType === "in")
        .map(([uid]) => uid);
    if (allPunchedInIds.length === 0)
        return [];
    // Filter to only ASM-mode users — inactive/no-movement alerts are irrelevant for office employees.
    const asmUsers = yield user_1.default.find({
        _id: { $in: allPunchedInIds },
        activeMode: "asm",
    }).select("_id").lean();
    const punchedInUserIds = asmUsers.map((u) => u._id.toString());
    if (punchedInUserIds.length === 0)
        return [];
    // 2. Get latest location log for each punched-in user
    const latestLogs = yield locationlogs_1.default.aggregate([
        { $match: { user: { $in: punchedInUserIds.map(id => require("mongoose").Types.ObjectId(id)) } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$user", lastTimestamp: { $first: "$timestamp" }, location: { $first: "$location" } } },
    ]);
    const logMap = new Map();
    for (const l of latestLogs) {
        logMap.set(l._id.toString(), { lastTimestamp: l.lastTimestamp, location: l.location });
    }
    // 3. Filter: last log > threshold ago OR never sent a log
    const thresholdMs = INACTIVE_THRESHOLD_MINUTES * 60 * 1000;
    const now = Date.now();
    const users = yield user_1.default.find({ _id: { $in: punchedInUserIds } }).select("name employeeId").lean();
    const userInfoMap = new Map(users.map((u) => [u._id.toString(), u]));
    const inactive = punchedInUserIds
        .map(uid => {
        const logInfo = logMap.get(uid);
        const lastSeen = logInfo ? new Date(logInfo.lastTimestamp) : null;
        const minutesSinceLast = lastSeen ? Math.round((now - lastSeen.getTime()) / 60000) : null;
        const isInactive = !lastSeen || (now - lastSeen.getTime()) > thresholdMs;
        if (!isInactive)
            return null;
        const userInfo = userInfoMap.get(uid) || {};
        return {
            userId: uid,
            employeeName: userInfo.name || "Unknown",
            employeeId: userInfo.employeeId || "",
            punchInTime: userPunchMap.get(uid).punchInTime,
            lastLocationTime: lastSeen,
            minutesSinceLastLocation: minutesSinceLast,
            lastLocation: (logInfo === null || logInfo === void 0 ? void 0 : logInfo.location) || null,
        };
    })
        .filter(Boolean);
    return inactive;
});
const getInactiveUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const inactive = yield findInactiveEmployees();
        res.status(200).json({ success: true, count: inactive.length, data: inactive });
    }
    catch (error) {
        console.error("Get inactive users error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getInactiveUsers = getInactiveUsers;
const autoPunchOut = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const inactive = yield findInactiveEmployees();
        if (inactive.length === 0) {
            return res.status(200).json({ success: true, message: "No inactive users found", autoPunchedOut: 0 });
        }
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let autoPunchedOut = 0;
        for (const emp of inactive) {
            // Create alert if no recent no_movement alert exists for this user
            const recentAlert = yield alert_1.default.findOne({
                user: emp.userId,
                type: "no_movement",
                timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // last 1 hour
            });
            if (!recentAlert) {
                yield alert_1.default.create({
                    user: emp.userId,
                    type: "no_movement",
                    description: `No location update for ${(_a = emp.minutesSinceLastLocation) !== null && _a !== void 0 ? _a : "unknown"} minutes`,
                });
            }
            // Auto punch-out: create a punch-out record using last known location
            const lastLoc = emp.lastLocation || { lat: 0, lng: 0 };
            yield punch_1.default.create({
                user: emp.userId,
                type: "out",
                date: today,
                time: now,
                location: { lat: lastLoc.lat, lng: lastLoc.lng, address: "Auto Punch-Out (location timeout)" },
                selfie: "system",
                verified: false,
                isAutomatic: true,
                reason: "Location timeout — auto punch-out",
            });
            // Persist the day's travel distance (same as a manual punch-out).
            yield (0, persistTravelDistance_1.persistDailyTravelDistance)(String(emp.userId)).catch((err) => console.error("[Auto Punch-Out] Failed to persist travel distance:", err));
            autoPunchedOut++;
        }
        res.status(200).json({ success: true, message: `Auto punched out ${autoPunchedOut} employee(s)`, autoPunchedOut });
    }
    catch (error) {
        console.error("Auto punch-out error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.autoPunchOut = autoPunchOut;
// POST /api/admin/cron/close-open-sessions
// Hard end-of-day closer. Unlike autoPunchOut (which only targets inactive ASM
// users), this closes EVERY open session for the day — any user whose latest
// punch today is an "in" — so sessions never carry across days regardless of
// employee mode or location activity. Schedule once near end of working hours.
const closeOpenSessions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();
        // Latest punch per user today (ascending sort → last write wins = latest).
        const punchesToday = yield punch_1.default.find({ date: { $gte: today } })
            .sort({ time: 1 })
            .lean();
        const lastByUser = new Map();
        for (const p of punchesToday) {
            lastByUser.set(p.user.toString(), p);
        }
        const openUsers = Array.from(lastByUser.entries())
            .filter(([, p]) => p.type === "in")
            .map(([uid, p]) => ({ uid, lastPunch: p }));
        let closed = 0;
        for (const { uid, lastPunch } of openUsers) {
            // Prefer the most recent known location; fall back to the punch-in location.
            const lastLog = yield locationlogs_1.default.findOne({ user: uid })
                .sort({ timestamp: -1 })
                .select("location")
                .lean();
            const loc = (lastLog === null || lastLog === void 0 ? void 0 : lastLog.location) || lastPunch.location || { lat: 0, lng: 0 };
            yield punch_1.default.create({
                user: uid,
                type: "out",
                date: today,
                time: now,
                location: { lat: loc.lat, lng: loc.lng, address: "Auto Punch-Out (end of day)" },
                selfie: "system",
                verified: false,
                isAutomatic: true,
                reason: "End of day — auto punch-out",
            });
            // Persist the day's travel distance (same as a manual punch-out).
            yield (0, persistTravelDistance_1.persistDailyTravelDistance)(uid).catch((err) => console.error("[Close Open Sessions] Failed to persist travel distance:", err));
            closed++;
        }
        res.status(200).json({ success: true, message: `Closed ${closed} open session(s)`, closed });
    }
    catch (error) {
        console.error("Close open sessions error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.closeOpenSessions = closeOpenSessions;
// GET /api/admin/employees/:id/performance
// Returns latest monthly performance metrics shaped for a radar chart
const getEmployeePerformance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { id } = req.params;
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const perf = yield performance_1.default.findOne({
            user: id,
            period: "monthly",
            periodStart: { $gte: monthStart },
        }).sort({ periodStart: -1 }).lean();
        if (!perf) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No performance data for this month yet",
            });
        }
        const m = perf.metrics || {};
        res.status(200).json({
            success: true,
            data: {
                score: perf.score,
                attendance: Math.round(((_a = m.attendance) !== null && _a !== void 0 ? _a : 0) * 100),
                punctuality: Math.round(((_b = m.punctuality) !== null && _b !== void 0 ? _b : 0) * 100),
                visits: Math.round(((_c = m.visitCount) !== null && _c !== void 0 ? _c : 0) * 100),
                productive: Math.round(((_d = m.productiveRatio) !== null && _d !== void 0 ? _d : 0) * 100),
                distance: Math.round(((_e = m.distance) !== null && _e !== void 0 ? _e : 0) * 100),
                tasks: Math.round(((_f = m.taskCompletion) !== null && _f !== void 0 ? _f : 0) * 100),
                breaks: Math.round(((_g = m.breakDiscipline) !== null && _g !== void 0 ? _g : 0) * 100),
                stock: Math.round(((_h = m.stockConsistency) !== null && _h !== void 0 ? _h : 0) * 100),
                period: {
                    start: perf.periodStart,
                    end: perf.periodEnd,
                },
            },
        });
    }
    catch (error) {
        console.error("Get employee performance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getEmployeePerformance = getEmployeePerformance;
// GET /api/admin/employees/:id/weekly-hours
// Returns Mon–Sat hours breakdown: productive, break, idle
const getEmployeeWeeklyHours = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const IDLE_GAP_MS = 15 * 60 * 1000; // 15-min gap in location = idle
    try {
        const { id } = req.params;
        // Build Mon–Sat for current week
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMon);
        monday.setHours(0, 0, 0, 0);
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const result = [];
        for (let i = 0; i < 6; i++) {
            const dayStart = new Date(monday);
            dayStart.setDate(monday.getDate() + i);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            const [punches, breaks, locationLogs] = yield Promise.all([
                punch_1.default.find({ user: id, date: { $gte: dayStart, $lte: dayEnd } }).sort({ time: 1 }).lean(),
                break_1.default.find({ user: id, startTime: { $gte: dayStart, $lte: dayEnd }, endTime: { $ne: null } }).lean(),
                locationlogs_1.default.find({ user: id, timestamp: { $gte: dayStart, $lte: dayEnd } }).sort({ timestamp: 1 }).lean(),
            ]);
            // Total working hours (first punch-in → last punch-out)
            const firstIn = punches.find(p => p.type === "in");
            const lastOut = [...punches].reverse().find(p => p.type === "out");
            let workMs = 0;
            if (firstIn) {
                const endMs = lastOut ? new Date(lastOut.time).getTime() : dayEnd.getTime();
                workMs = endMs - new Date(firstIn.time).getTime();
            }
            // Total break hours
            const breakMs = breaks.reduce((sum, b) => { var _a; return sum + ((_a = b.duration) !== null && _a !== void 0 ? _a : 0) * 60 * 1000; }, 0);
            // Idle = gaps > 15 min in location logs during work time.
            // Note: LocationLog has a TTL index — logs older than LOCATION_TTL_DAYS will be
            // purged by MongoDB. When that happens locationLogs will be empty and idleMs
            // stays 0 (safe default: productive = workMs - breakMs, no data lost).
            let idleMs = 0;
            if (firstIn && locationLogs.length > 1) {
                for (let j = 1; j < locationLogs.length; j++) {
                    const gap = new Date(locationLogs[j].timestamp).getTime() - new Date(locationLogs[j - 1].timestamp).getTime();
                    if (gap > IDLE_GAP_MS)
                        idleMs += gap;
                }
            }
            const productiveMs = Math.max(0, workMs - breakMs - idleMs);
            result.push({
                day: days[i],
                date: dayStart.toISOString().split("T")[0],
                productive: parseFloat((productiveMs / 3600000).toFixed(2)),
                break: parseFloat((breakMs / 3600000).toFixed(2)),
                idle: parseFloat((idleMs / 3600000).toFixed(2)),
            });
        }
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        console.error("Get employee weekly hours error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getEmployeeWeeklyHours = getEmployeeWeeklyHours;
// GET /api/admin/employees/:id/stock?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns flattened stock items submitted by a specific user
const getEmployeeStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { start, end } = req.query;
        const query = { user: id };
        if (start && end) {
            query.date = { $gte: new Date(start), $lte: new Date(end) };
        }
        const tasks = yield task_1.default.find(query)
            .select("stock showroomName date address")
            .sort({ date: -1 })
            .lean();
        const stockItems = [];
        tasks.forEach((task) => {
            if (!Array.isArray(task.stock))
                return;
            task.stock.forEach((item) => {
                var _a, _b;
                if ("model" in item && item.model && (item.quantity || 0) > 0) {
                    stockItems.push({
                        taskId: task._id,
                        showroom: task.showroomName,
                        address: ((_a = task.address) === null || _a === void 0 ? void 0 : _a.fullAddress) || "",
                        date: task.date,
                        itemType: "scooter",
                        item: item.model + (item.variation ? ` (${item.variation})` : ""),
                        qty: item.quantity,
                    });
                }
                if ("batteryType" in item && item.batteryType && (item.batteryQuantity || 0) > 0) {
                    stockItems.push({
                        taskId: task._id,
                        showroom: task.showroomName,
                        address: ((_b = task.address) === null || _b === void 0 ? void 0 : _b.fullAddress) || "",
                        date: task.date,
                        itemType: "battery",
                        item: `${item.batteryType} Battery`,
                        qty: item.batteryQuantity,
                    });
                }
            });
        });
        res.status(200).json({ success: true, data: stockItems, total: stockItems.length });
    }
    catch (error) {
        console.error("Get employee stock error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getEmployeeStock = getEmployeeStock;
