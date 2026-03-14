import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import User from "../models/user";
import Punch from "../models/punch";
import LocationLog from "../models/locationlogs";

const LOCATION_ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// GET /api/users
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const { search, page = "1", limit = "10" } = req.query;

        const query: any = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { employeeId: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const pageNumber = parseInt(page as string, 10) || 1;
        const limitNumber = parseInt(limit as string, 10) || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const users = await User.find(query)
            .select("-password")
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean();

        const total = await User.countDocuments(query);
        const userIds = users.map((u: any) => u._id);
        const { start, end } = getTodayRange();

        // Batch: today's punches for all users
        const punchesToday = await Punch.find({ user: { $in: userIds }, date: { $gte: start, $lte: end } })
            .sort({ time: 1 })
            .lean();

        // Batch: latest location log per user
        const latestLogs = await LocationLog.aggregate([
            { $match: { user: { $in: userIds }, timestamp: { $gte: start } } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$user", timestamp: { $first: "$timestamp" }, location: { $first: "$location" } } },
        ]);

        // Build lookup maps
        const punchMap = new Map<string, { isPunchedIn: boolean; punchInTime: Date | null; punchOutTime: Date | null }>();
        for (const uid of userIds) {
            const userPunches = punchesToday.filter(p => p.user.toString() === uid.toString());
            const firstIn = userPunches.find(p => p.type === "in");
            const lastOut = [...userPunches].reverse().find(p => p.type === "out");
            const last = userPunches[userPunches.length - 1];
            punchMap.set(uid.toString(), {
                isPunchedIn: last?.type === "in" || false,
                punchInTime: firstIn?.time || null,
                punchOutTime: lastOut?.time || null,
            });
        }

        const locationMap = new Map<string, { lat: number; lng: number; timestamp: Date }>();
        for (const l of latestLogs) {
            locationMap.set(l._id.toString(), { ...l.location, timestamp: l.timestamp });
        }

        const now = Date.now();
        const data = users.map((u: any) => {
            const uid = u._id.toString();
            const punch = punchMap.get(uid);
            const loc = locationMap.get(uid);
            return {
                ...u,
                isPunchedIn: punch?.isPunchedIn ?? false,
                punchInTime: punch?.punchInTime ?? null,
                punchOutTime: punch?.punchOutTime ?? null,
                lastLocation: loc ? { lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp } : null,
                locationSharingActive: loc ? (now - new Date(loc.timestamp).getTime()) < LOCATION_ACTIVE_THRESHOLD_MS : false,
            };
        });

        res.status(200).json({
            success: true,
            data,
            pagination: { total, page: pageNumber, pages: Math.ceil(total / limitNumber) }
        });
    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select("-password").populate("managedBy", "name employeeId email").lean();

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const { start, end } = getTodayRange();

        const [punchesToday, latestLog] = await Promise.all([
            Punch.find({ user: id, date: { $gte: start, $lte: end } }).sort({ time: 1 }).lean(),
            LocationLog.findOne({ user: id }).sort({ timestamp: -1 }).lean(),
        ]);

        const firstIn = punchesToday.find(p => p.type === "in");
        const lastOut = [...punchesToday].reverse().find(p => p.type === "out");
        const lastPunch = punchesToday[punchesToday.length - 1];
        const isPunchedIn = lastPunch?.type === "in" || false;

        const now = Date.now();
        const locationSharingActive = latestLog
            ? (now - new Date(latestLog.timestamp).getTime()) < LOCATION_ACTIVE_THRESHOLD_MS
            : false;

        res.status(200).json({
            success: true,
            data: {
                ...user,
                isPunchedIn,
                punchInTime: firstIn?.time ?? null,
                punchOutTime: lastOut?.time ?? null,
                lastLocation: latestLog ? { lat: latestLog.location.lat, lng: latestLog.location.lng, timestamp: latestLog.timestamp } : null,
                locationSharingActive,
            }
        });
    } catch (error) {
        console.error("Get user by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// PUT /api/users/:id
export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Ensure we don't accidentally hash passwords here if pass isn't handled correctly
        if (updateData.password) {
            delete updateData.password;
        }

        const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user
        });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
