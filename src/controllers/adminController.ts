import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import User from "../models/user";
import Punch from "../models/punch";
import LocationLog from "../models/locationlogs";
import Alert from "../models/alert";
import Performance from "../models/performance";
import Task from "../models/task";
import { haversineDistance } from "../utils/healper";

export const getAdminDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Total Employees
        const totalEmployees = await User.countDocuments({ role: "employee", isActive: true });

        // 2. Active Now (Employees who have punched in but not out today, or recently logged a location)
        // First find users who punched in today
        const punchesToday = await Punch.find({ date: { $gte: today, $lte: endOfDay } }).sort({ time: 1 });

        // Group by user to find their last punch
        const userPunchStatus = new Map<string, string>(); // userId -> "in" | "out"
        punchesToday.forEach(punch => {
            userPunchStatus.set(punch.user.toString(), punch.type);
        });

        let activeNowCount = 0;
        Array.from(userPunchStatus.values()).forEach(status => {
            if (status === "in") activeNowCount++;
        });

        // 3. Punctuality Overview (On time vs Late)
        // Assuming 09:30 AM is the cutoff for "On Time"
        const onTimeCutoff = new Date(today);
        onTimeCutoff.setHours(9, 30, 0, 0);

        let onTimeCount = 0;
        let lateCount = 0;

        // Get the first punch-in for each user
        const firstPunches = new Map<string, Date>();
        punchesToday.forEach(punch => {
            if (punch.type === "in") {
                const existing = firstPunches.get(punch.user.toString());
                if (!existing || punch.time < existing) {
                    firstPunches.set(punch.user.toString(), punch.time);
                }
            }
        });

        firstPunches.forEach(time => {
            if (time <= onTimeCutoff) onTimeCount++;
            else lateCount++;
        });

        const punctuality = [
            { name: "On Time", value: onTimeCount },
            { name: "Late", value: lateCount }
        ];

        // 4. Recent Anomalies
        const recentAnomalies = await Alert.find({ resolved: false })
            .populate("user", "name employeeId")
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        const formattedAnomalies = recentAnomalies.map(a => ({
            id: a._id,
            employee: (a.user as any)?.name || "Unknown",
            type: a.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), // Title case
            timestamp: a.timestamp,
            severity: ["no_movement", "gps_disabled", "device_off"].includes(a.type) ? "High" : "Medium",
            status: a.resolved ? "Resolved" : "Active",
            description: a.description
        }));

        res.status(200).json({
            success: true,
            data: {
                totalEmployees,
                activeNow: activeNowCount,
                punctuality,
                recentAnomalies: formattedAnomalies,
            }
        });
    } catch (error) {
        console.error("Admin dashboard error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getLiveLocations = async (req: AuthRequest, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get the most recent location log for each user today
        const liveLocations = await LocationLog.aggregate([
            { $match: { timestamp: { $gte: today } } },
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
        const users = await User.find({ _id: { $in: userIds } }).select("name employeeId department");

        const userMap = new Map();
        users.forEach((u: any) => userMap.set(u._id.toString(), u));

        const formattedLocations = liveLocations.map(loc => {
            const user = userMap.get(loc._id.toString());
            return {
                id: user?.employeeId || loc._id.toString(),
                userId: loc._id,
                name: user?.name || "Unknown",
                department: user?.department || "Unassigned",
                latitude: loc.location.lat,
                longitude: loc.location.lng,
                lastUpdate: loc.timestamp,
                battery: loc.battery,
                speed: loc.speed,
                status: loc.isOffline ? "offline" : "online"
            };
        });

        res.status(200).json({
            success: true,
            data: formattedLocations
        });
    } catch (error) {
        console.error("Get live locations error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getLocationHistory = async (req: AuthRequest, res: Response) => {
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

        const UserObj = await User.findById(userId).select("name employeeId");
        if (!UserObj) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Fetch all logs for the user on that date, sorted sequentially
        const logs = await LocationLog.find({
            user: userId,
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: 1 }).lean();

        // Fetch tasks for this user on this date to match showroom info
        const tasks = await Task.find({
            user: userId,
            date: { $gte: startOfDay, $lte: endOfDay }
        }).lean();

        const route = logs.map((log, i) => {
            let showroomName = "";
            let location = "";

            // Find nearest task within 200m
            for (const task of tasks) {
                if (task.address?.lat && task.address?.lng) {
                    const dist = haversineDistance(log.location.lat, log.location.lng, task.address.lat, task.address.lng);
                    if (dist <= 0.2) {
                        showroomName = task.showroomName;
                        location = task.address.fullAddress || "";
                        break;
                    }
                }
            }

            // Distance from previous point (km)
            const distance = i > 0
                ? parseFloat(haversineDistance(logs[i - 1].location.lat, logs[i - 1].location.lng, log.location.lat, log.location.lng).toFixed(2))
                : 0;

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

    } catch (error) {
        console.error("Get location history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getEmployeeStats = async (req: AuthRequest, res: Response) => {
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

        const UserObj = await User.findById(userId).select("name employeeId");
        if (!UserObj) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let performance = await Performance.findOne({
            user: userId,
            period: "daily",
            periodStart: targetDate
        });

        let score = performance?.score || 0;
        let distanceTraveled = performance?.metrics?.distance || 0;

        const tasks = await Task.countDocuments({
            user: userId,
            date: { $gte: targetDate, $lte: endOfDay }
        });

        const punches = await Punch.find({
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
                if (hoursWorked < 0 || hoursWorked > 24) hoursWorked = 0;
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

    } catch (error) {
        console.error("Get specific employee stats error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

const INACTIVE_THRESHOLD_MINUTES = 30;

// Shared helper: find employees who are punched in but stopped sending location
const findInactiveEmployees = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Get all today's punches, find who is currently punched in
    const punchesToday = await Punch.find({ date: { $gte: today } }).sort({ time: 1 }).lean();
    const userPunchMap = new Map<string, { lastType: string; punchInTime: Date }>();
    for (const p of punchesToday) {
        const uid = p.user.toString();
        const existing = userPunchMap.get(uid);
        if (!existing || p.time > existing.punchInTime) {
            userPunchMap.set(uid, {
                lastType: p.type,
                punchInTime: existing?.lastType === "in" ? existing.punchInTime : p.time,
            });
        }
    }

    const punchedInUserIds = Array.from(userPunchMap.entries())
        .filter(([, v]) => v.lastType === "in")
        .map(([uid]) => uid);

    if (punchedInUserIds.length === 0) return [];

    // 2. Get latest location log for each punched-in user
    const latestLogs = await LocationLog.aggregate([
        { $match: { user: { $in: punchedInUserIds.map(id => require("mongoose").Types.ObjectId(id)) } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: "$user", lastTimestamp: { $first: "$timestamp" }, location: { $first: "$location" } } },
    ]);

    const logMap = new Map<string, { lastTimestamp: Date; location: any }>();
    for (const l of latestLogs) {
        logMap.set(l._id.toString(), { lastTimestamp: l.lastTimestamp, location: l.location });
    }

    // 3. Filter: last log > threshold ago OR never sent a log
    const thresholdMs = INACTIVE_THRESHOLD_MINUTES * 60 * 1000;
    const now = Date.now();

    const users = await User.find({ _id: { $in: punchedInUserIds } }).select("name employeeId").lean();
    const userInfoMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    const inactive = punchedInUserIds
        .map(uid => {
            const logInfo = logMap.get(uid);
            const lastSeen = logInfo ? new Date(logInfo.lastTimestamp) : null;
            const minutesSinceLast = lastSeen ? Math.round((now - lastSeen.getTime()) / 60000) : null;
            const isInactive = !lastSeen || (now - lastSeen.getTime()) > thresholdMs;
            if (!isInactive) return null;

            const userInfo: any = userInfoMap.get(uid) || {};
            return {
                userId: uid,
                employeeName: userInfo.name || "Unknown",
                employeeId: userInfo.employeeId || "",
                punchInTime: userPunchMap.get(uid)!.punchInTime,
                lastLocationTime: lastSeen,
                minutesSinceLastLocation: minutesSinceLast,
                lastLocation: logInfo?.location || null,
            };
        })
        .filter(Boolean);

    return inactive;
};

export const getInactiveUsers = async (req: AuthRequest, res: Response) => {
    try {
        const inactive = await findInactiveEmployees();
        res.status(200).json({ success: true, count: inactive.length, data: inactive });
    } catch (error) {
        console.error("Get inactive users error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const autoPunchOut = async (req: AuthRequest, res: Response) => {
    try {
        const inactive = await findInactiveEmployees() as any[];
        if (inactive.length === 0) {
            return res.status(200).json({ success: true, message: "No inactive users found", autoPunchedOut: 0 });
        }

        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let autoPunchedOut = 0;
        for (const emp of inactive) {
            // Create alert if no recent no_movement alert exists for this user
            const recentAlert = await Alert.findOne({
                user: emp.userId,
                type: "no_movement",
                timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // last 1 hour
            });

            if (!recentAlert) {
                await Alert.create({
                    user: emp.userId,
                    type: "no_movement",
                    description: `No location update for ${emp.minutesSinceLastLocation ?? "unknown"} minutes`,
                });
            }

            // Auto punch-out: create a punch-out record using last known location
            const lastLoc = emp.lastLocation || { lat: 0, lng: 0 };
            await Punch.create({
                user: emp.userId,
                type: "out",
                date: today,
                time: now,
                location: { lat: lastLoc.lat, lng: lastLoc.lng, address: "Auto Punch-Out (location timeout)" },
                selfie: "system",
                verified: false,
            });

            autoPunchedOut++;
        }

        res.status(200).json({ success: true, message: `Auto punched out ${autoPunchedOut} employee(s)`, autoPunchedOut });
    } catch (error) {
        console.error("Auto punch-out error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
