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
  try {
    // ────────────────────────────────────────────────
    //               Query Parameters
    // ────────────────────────────────────────────────
    const {
      page = "1",
      limit = "20",
      startDate,          // YYYY-MM-DD
      endDate,            // YYYY-MM-DD
      status,             // "active" | "ended" | "overdue" | "all" (default: all)
      search,             // employee name partial search
      month,              // fallback if no date range → "2025-03"
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    // ────────────────────────────────────────────────
    //                Build MongoDB Query
    // ────────────────────────────────────────────────
    const query: any = {};

    // 1. Date range filter (preferred over month)
    if (startDate || endDate) {
      query.startTime = {};

      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.startTime.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.startTime.$lte = end;
      }
    }
    // Fallback: month filter (e.g. "2025-03")
    else if (month) {
      const [year, mon] = (month as string).split("-").map(Number);
      if (!isNaN(year) && !isNaN(mon)) {
        query.startTime = {
          $gte: new Date(year, mon - 1, 1),
          $lte: new Date(year, mon, 0, 23, 59, 59, 999),
        };
      }
    }

    // 2. Search by employee name (requires population → we'll use $lookup or post-filter)
    //    → easiest is to populate first and filter in JS for small/medium datasets
    //    → for large scale → use aggregation with $lookup + $match

    // 3. Status filter (active/ended/overdue)
    const now = new Date();
    if (status && status !== "all") {
      if (status === "active") {
        query.endTime = { $exists: false };
      } else if (status === "ended") {
        query.endTime = { $exists: true };
      } else if (status === "overdue") {
        // running breaks longer than 30 minutes
        query.endTime = { $exists: false };
        // We'll calculate running time later — can't do >30min directly in query
        // → we'll filter in JS after fetch
      }
    }

    // ────────────────────────────────────────────────
    //              Fetch Breaks with Pagination
    // ────────────────────────────────────────────────
    const breaks = await Break.find(query)
      .populate({
        path: "user",
        select: "name managedBy",
        populate: {
          path: "managedBy",
          select: "name",
        },
      })
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // ────────────────────────────────────────────────
    //       Post-processing + status calculation
    // ────────────────────────────────────────────────
    const enrichedBreaks = breaks
      .map((b: any) => {
        const user = b.user || {};
        const manager = user.managedBy || {};

        const start = new Date(b.startTime);
        const isEnded = !!b.endTime;
        let runningMinutes = 0;

        if (!isEnded) {
          runningMinutes = Math.round((now.getTime() - start.getTime()) / 60000);
        }

        let breakStatus: string;
        if (isEnded) {
          breakStatus = "ended";
        } else if (runningMinutes > 30) {
          breakStatus = "overdue";
        } else {
          breakStatus = "active";
        }

        return {
          _id: b._id,
          employeeName: user.name || "Unknown",
          managerName: manager.name || "Unknown",
          date: start.toISOString().split("T")[0],
          breakStart: b.startTime,
          breakEnd: b.endTime || null,
          duration: b.duration ?? runningMinutes,
          status: breakStatus,
          startLocation: b.startLocation || null,
          endLocation: b.endLocation || null,
        };
      })
      // Optional: filter by status in memory if "overdue" was requested
      .filter((b) => {
        if (status === "overdue") return b.status === "overdue";
        return true;
      });

    // ────────────────────────────────────────────────
    //             Optional: name search in memory
    // ────────────────────────────────────────────────
    let finalData = enrichedBreaks;

    if (search && typeof search === "string" && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      finalData = enrichedBreaks.filter((b) =>
        b.employeeName.toLowerCase().includes(searchLower)
      );
    }

    // ────────────────────────────────────────────────
    //                   Pagination Meta
    // ────────────────────────────────────────────────
    const total = await Break.countDocuments(query); // Note: doesn't include post-filters

    res.status(200).json({
      success: true,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
      data: finalData,
    });
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
