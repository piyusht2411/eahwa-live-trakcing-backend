import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Punch from "../models/punch";
import User from "../models/user";
import { Types } from "mongoose";

export const getAttendance = async (req: Request, res: Response) => {
    try {
        const {
            date,           // YYYY-MM-DD (single day)
            year,
            month,          // 1-12
            userId,         // filter by specific user
            page = "1",
            limit = "20",
            groupByDay,     // "true" → one row per employee/day with in/out/total
        } = req.query;

        const authUser = req.user!;
        const adminRoles = ["admin", "super_manager", "hr"];
        const isAdminLevel = adminRoles.includes(authUser.role);

        // ====================== Pagination ======================
        const currentPage = Math.max(1, parseInt(page as string) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20)); // max 100 per page

        // ====================== Resolve allowed user IDs for managers ======================
        // Managers only see attendance of employees they manage.
        // Admin / super_manager / hr see everyone.
        let allowedUserIds: Types.ObjectId[] | null = null; // null = no restriction

        if (!isAdminLevel) {
            // Manager: fetch only their direct reports
            const teamMembers = await User.find(
                { managedBy: authUser._id, isActive: true },
                { _id: 1, name: 1, employeeId: 1 }
            ).lean();
            allowedUserIds = teamMembers.map((u: any) => u._id as Types.ObjectId);
        }

        // ====================== User Filter ======================
        const userFilter: Record<string, any> = {};

        if (userId && typeof userId === "string") {
            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ success: false, message: "Invalid userId" });
            }
            const requestedId = new Types.ObjectId(userId);
            // If manager, make sure the requested userId is within their team
            if (allowedUserIds !== null && !allowedUserIds.some(id => id.equals(requestedId))) {
                return res.status(403).json({ success: false, message: "Access denied: user not in your team" });
            }
            userFilter.user = requestedId;
        } else if (allowedUserIds !== null) {
            // No specific userId requested → restrict to manager's team
            userFilter.user = { $in: allowedUserIds };
        }

        // ====================== Date Filtering Logic ======================
        let startDate: Date;
        let endDate: Date;

        if (date && typeof date === "string") {
            // 1. Single day filter (highest priority)
            const [y, m, d] = (date as string).split("-").map(Number);
            startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
            endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
        }
        else if (year && month) {
            // 2. Full month filter
            const y = parseInt(year as string);
            const m = parseInt(month as string) - 1;
            startDate = new Date(y, m, 1, 0, 0, 0, 0);
            endDate = new Date(y, m + 1, 0, 23, 59, 59, 999); // last day of month
        }
        else if (year) {
            // 3. Full year filter
            const y = parseInt(year as string);
            startDate = new Date(y, 0, 1, 0, 0, 0, 0);
            endDate = new Date(y, 11, 31, 23, 59, 59, 999);
        }
        else {
            // 4. Default → Today
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }

        const query = { ...userFilter, date: { $gte: startDate, $lte: endDate } };

        // ====================== Dropdown users (scoped by role) ======================
        const usersQuery: Record<string, any> = { isActive: true };
        if (allowedUserIds !== null) {
            usersQuery._id = { $in: allowedUserIds };
        }

        // Dropdown users (needed by both modes)
        const users = await User.find(usersQuery, { _id: 1, name: 1, employeeId: 1 }).lean();

        const filtersMeta = {
            applied: date ? "day" : year && month ? "month" : year ? "year" : "today",
            userId: userId || undefined,
            date: date || undefined,
            year: year || undefined,
            month: month || undefined,
        };

        // ====================== Day-grouped mode (admin table totals) ======================
        // Returns ONE row per employee per calendar day, pairing the first punch-in
        // with the last punch-out and computing worked hours — so the total is always
        // correct regardless of pagination (unlike pairing raw events client-side).
        if (groupByDay === "true" || groupByDay === "1") {
            const allPunches = await Punch.find(query)
                .populate("user", "name employeeId department")
                .sort({ time: 1 }) // ascending so first=in, last=out fall out naturally
                .lean();

            const groupsMap = new Map<string, any>();
            for (const p of allPunches as any[]) {
                const uid = p.user?._id ? String(p.user._id) : "unknown";
                const dayKey = new Date(p.time).toISOString().slice(0, 10); // UTC calendar day
                const key = `${uid}_${dayKey}`;

                let g = groupsMap.get(key);
                if (!g) {
                    g = {
                        _id: key,
                        user: p.user,
                        date: p.date,
                        punchIn: null,
                        punchOut: null,
                    };
                    groupsMap.set(key, g);
                }

                if (p.type === "in") {
                    // earliest punch-in of the day
                    if (!g.punchIn || new Date(p.time) < new Date(g.punchIn.time)) {
                        g.punchIn = {
                            time: p.time, isLate: p.isLate ?? false,
                            selfie: p.selfie ?? null, location: p.location,
                        };
                    }
                } else {
                    // latest punch-out of the day
                    if (!g.punchOut || new Date(p.time) > new Date(g.punchOut.time)) {
                        g.punchOut = {
                            time: p.time, isAutomatic: p.isAutomatic ?? false,
                            selfie: p.selfie ?? null, reason: p.reason ?? null,
                        };
                    }
                }
            }

            const groups = Array.from(groupsMap.values()).sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            // Compute total worked hours per group (with the same guards as the app)
            const MIN_VALID_TS = new Date("2020-01-01T00:00:00Z").getTime();
            const MAX_SESSION_MS = 24 * 60 * 60 * 1000;
            for (const g of groups) {
                let total = "—";
                if (g.punchIn?.time && g.punchOut?.time) {
                    const inMs = new Date(g.punchIn.time).getTime();
                    const outMs = new Date(g.punchOut.time).getTime();
                    const diff = outMs - inMs;
                    if (Number.isFinite(inMs) && Number.isFinite(outMs) &&
                        inMs >= MIN_VALID_TS && diff >= 0 && diff <= MAX_SESSION_MS) {
                        const mins = Math.floor(diff / 60000);
                        total = `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    }
                }
                g.totalHours = total;
            }

            const totalRecords = groups.length;
            const totalPages = Math.ceil(totalRecords / pageSize);
            const paged = groups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

            return res.status(200).json({
                success: true,
                grouped: true,
                data: paged,
                users,
                pagination: {
                    totalRecords, totalPages, currentPage, pageSize,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1,
                },
                filters: filtersMeta,
            });
        }

        // ====================== Default: event-log mode (unchanged) ======================
        const totalRecords = await Punch.countDocuments(query);

        const attendanceRecords = await Punch.find(query)
            .populate("user", "name employeeId department")
            .sort({ date: -1, time: -1 })           // ← Latest to oldest
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize)
            .lean();

        // ====================== Pagination Metadata ======================
        const totalPages = Math.ceil(totalRecords / pageSize);

        res.status(200).json({
            success: true,
            data: attendanceRecords,                 // includes isLate, user details, etc.
            users,                                   // for filter dropdown: [{ _id, name, employeeId }]
            pagination: {
                totalRecords,
                totalPages,
                currentPage,
                pageSize,
                hasNextPage: currentPage < totalPages,
                hasPrevPage: currentPage > 1,
            },
            filters: filtersMeta,
        });
    } catch (error) {
        console.error("Get attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── GET /api/attendance/export — Full attendance data, no pagination ────────────
// Accepts the same filters as getAttendance (date / year+month / year / userId)
// but returns every matching record at once (for Excel / CSV exports).

export const exportAttendance = async (req: Request, res: Response) => {
    try {
        const {
            date,   // YYYY-MM-DD
            year,
            month,  // 1-12
            userId, // optional: filter by specific user
        } = req.query;

        const authUser = req.user!;
        const adminRoles = ["admin", "super_manager", "hr"];
        const isAdminLevel = adminRoles.includes(authUser.role);

        // ── Role-based scoping (same as getAttendance) ───────────────────────
        let allowedUserIds: Types.ObjectId[] | null = null;

        if (!isAdminLevel) {
            const teamMembers = await User.find(
                { managedBy: authUser._id, isActive: true },
                { _id: 1 }
            ).lean();
            allowedUserIds = teamMembers.map((u: any) => u._id as Types.ObjectId);
        }

        // ── User filter ───────────────────────────────────────────────────
        const userFilter: Record<string, any> = {};

        if (userId && typeof userId === "string") {
            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ success: false, message: "Invalid userId" });
            }
            const requestedId = new Types.ObjectId(userId);
            if (allowedUserIds !== null && !allowedUserIds.some(id => id.equals(requestedId))) {
                return res.status(403).json({ success: false, message: "Access denied: user not in your team" });
            }
            userFilter.user = requestedId;
        } else if (allowedUserIds !== null) {
            userFilter.user = { $in: allowedUserIds };
        }

        // ── Date range ───────────────────────────────────────────────────
        let startDate: Date;
        let endDate: Date;

        if (date && typeof date === "string") {
            const [y, m, d] = (date as string).split("-").map(Number);
            startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
            endDate   = new Date(y, m - 1, d, 23, 59, 59, 999);
        } else if (year && month) {
            const y = parseInt(year as string);
            const m = parseInt(month as string) - 1;
            startDate = new Date(y, m, 1, 0, 0, 0, 0);
            endDate   = new Date(y, m + 1, 0, 23, 59, 59, 999);
        } else if (year) {
            const y = parseInt(year as string);
            startDate = new Date(y, 0, 1, 0, 0, 0, 0);
            endDate   = new Date(y, 11, 31, 23, 59, 59, 999);
        } else {
            // Default → Today
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }

        const query = { ...userFilter, date: { $gte: startDate, $lte: endDate } };

        // ── Fetch all matching records (no pagination) ────────────────────────
        const attendanceRecords = await Punch.find(query)
            .populate("user", "name employeeId department")
            .sort({ date: -1, time: -1 }) // Latest first
            .lean();

        res.status(200).json({
            success: true,
            data:    attendanceRecords,
            total:   attendanceRecords.length,
            filters: {
                applied:  date ? "day" : year && month ? "month" : year ? "year" : "today",
                userId:   userId  || undefined,
                date:     date    || undefined,
                year:     year    || undefined,
                month:    month   || undefined,
            },
        });
    } catch (error) {
        console.error("Export attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Add this function below your existing getAttendance

export const getUserAttendance = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;                    // ← From URL
    const {
      date,           // YYYY-MM-DD
      year,
      month,          // 1-12
    } = req.query;

    // Basic validation
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // ====================== Date Filtering Logic (same as getAttendance) ======================
    let startDate: Date;
    let endDate: Date;

    if (date && typeof date === "string") {
      const [y, m, d] = (date as string).split("-").map(Number);
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      endDate   = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    else if (year && month) {
      const y = parseInt(year as string);
      const m = parseInt(month as string) - 1;
      startDate = new Date(y, m, 1, 0, 0, 0, 0);
      endDate   = new Date(y, m + 1, 0, 23, 59, 59, 999);
    }
    else if (year) {
      const y = parseInt(year as string);
      startDate = new Date(y, 0, 1, 0, 0, 0, 0);
      endDate   = new Date(y, 11, 31, 23, 59, 59, 999);
    }
    else {
      // Default → Today
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    // ====================== Fetch Data ======================
    // The date range is already bounded (a single day / month / year), so a single
    // user's record set is small. We return EVERY record in the range — no skip/limit —
    // otherwise a `limit` smaller than 2×(days in month) silently truncates older days
    // (this is what made the profile list stop ~18 days back) and also corrupts the
    // monthly Present/Late/Days summary counts.
    const attendanceRecords = await Punch.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate("user", "name employeeId department")   // optional but consistent
      .sort({ date: -1, time: -1 })                     // Latest → Oldest
      .lean();

    const totalRecords = attendanceRecords.length;

    res.status(200).json({
      success: true,
      data: attendanceRecords,
      pagination: {
        totalRecords,
        totalPages: 1,
        currentPage: 1,
        pageSize: totalRecords,
        hasNextPage: false,
        hasPrevPage: false,
      },
      filters: {
        applied: date ? "day" : year && month ? "month" : year ? "year" : "today",
        date: date || undefined,
        year: year || undefined,
        month: month || undefined,
      },
    });
  } catch (error) {
    console.error("Get user attendance error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
