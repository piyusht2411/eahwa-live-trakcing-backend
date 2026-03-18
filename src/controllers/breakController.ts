import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Break from "../models/break";
import { isUserPunchedIn } from "../utils/punchCheck";

export const startBreak = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { location } = req.body;   // ← Expected from mobile app

    if (!location || !location.lat || !location.lng) {
        return res.status(400).json({
            success: false,
            message: "Location is required to start a break"
        });
    }

    // Check if user is punched in
    const punchedIn = await isUserPunchedIn(userId);
    if (!punchedIn) {
        return res.status(403).json({
            success: false,
            message: "You must be punched in to start a break"
        });
    }

    try {
        const activeBreak = await Break.findOne({ user: userId, endTime: { $exists: false } });
        if (activeBreak) {
            return res.status(400).json({ success: false, message: "A break is already active" });
        }

        const newBreak = new Break({
            user: userId,
            startTime: new Date(),
            startLocation: location,           // ← Saved
            type: "start",
        });

        await newBreak.save();

        res.status(201).json({
            success: true,
            message: "Break started successfully",
            data: newBreak,
        });
    } catch (error) {
        console.error("Start break error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const endBreak = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { location } = req.body;   // ← Optional but recommended

    try {
        const activeBreak = await Break.findOne({ user: userId, endTime: { $exists: false } });

        if (!activeBreak) {
            return res.status(404).json({ success: false, message: "No active break found to end" });
        }

        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - new Date(activeBreak.startTime).getTime()) / 60000);

        activeBreak.endTime = endTime;
        activeBreak.type = "end";
        activeBreak.duration = duration;

        // ← Save end location if provided
        if (location?.lat && location?.lng) {
            activeBreak.endLocation = location;
        }

        await activeBreak.save();

        res.status(200).json({
            success: true,
            message: "Break ended successfully",
            data: activeBreak,
        });
    } catch (error) {
        console.error("End break error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getAllBreaks = async (req: AuthRequest, res: Response) => {
    const { date, month } = req.query;

    try {
        let query: any = {};

        if (date) {
            const start = new Date(date as string);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date as string);
            end.setHours(23, 59, 59, 999);
            query.startTime = { $gte: start, $lte: end };
        } else if (month) {
            const [year, mon] = (month as string).split("-").map(Number);
            query.startTime = { $gte: new Date(year, mon - 1, 1), $lte: new Date(year, mon, 0, 23, 59, 59, 999) };
        }

        const breaks = await Break.find(query)
            .populate({ path: "user", select: "name managedBy", populate: { path: "managedBy", select: "name" } })
            .sort({ startTime: -1 })
            .lean();

        const now = Date.now();
        const data = breaks.map((b: any) => {
            const user = b.user || {};
            const manager = user.managedBy || {};
            const runningMins = !b.endTime
                ? Math.round((now - new Date(b.startTime).getTime()) / 60000)
                : 0;

            let status: string;
            if (b.endTime) status = "ended";
            else if (runningMins > 30) status = "overdue";
            else status = "active";

            return {
                _id: b._id,
                employeeName: user.name || "Unknown",
                managerName: manager.name || "Unknown",
                date: new Date(b.startTime).toISOString().split("T")[0],
                breakStart: b.startTime,
                breakEnd: b.endTime || null,
                duration: b.duration ?? runningMins,

                // ← NEW: Both locations
                startLocation: b.startLocation || null,
                endLocation: b.endLocation || null,

                status,
            };
        });

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Get all breaks error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getTodayBreaks = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const breaks = await Break.find({
            user: userId,
            startTime: { $gte: today }
        }).sort({ startTime: 1 });

        const totalBreakMinutes = breaks.reduce((total, brk) => total + (brk.duration || 0), 0);
        const activeBreak = breaks.find(b => !b.endTime) || null;

        res.status(200).json({
            success: true,
            data: {
                breaks,           // ← Now each break has startLocation & endLocation
                activeBreak,
                totalBreakMinutes,
                breaksTaken: breaks.length,
            }
        });
    } catch (error) {
        console.error("Get breaks error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
