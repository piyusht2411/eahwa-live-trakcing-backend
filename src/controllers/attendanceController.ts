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
            limit = "20"
        } = req.query;

        // ====================== Pagination ======================
        const currentPage = Math.max(1, parseInt(page as string) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20)); // max 100 per page

        // ====================== User Filter ======================
        const userFilter: Record<string, any> = {};
        if (userId && typeof userId === "string") {
            if (!Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ success: false, message: "Invalid userId" });
            }
            userFilter.user = new Types.ObjectId(userId);
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

        // ====================== Count Total Records + Fetch Users ======================
        const [totalRecords, users] = await Promise.all([
            Punch.countDocuments(query),
            User.find({ isActive: true }, { _id: 1, name: 1, employeeId: 1 }).lean(),
        ]);

        // ====================== Fetch Paginated & Sorted Data ======================
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
            filters: {
                applied: date ? "day" : year && month ? "month" : year ? "year" : "today",
                userId: userId || undefined,
                date: date || undefined,
                year: year || undefined,
                month: month || undefined,
            },
        });
    } catch (error) {
        console.error("Get attendance error:", error);
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
      page = "1", 
      limit = "20" 
    } = req.query;

    // Basic validation
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // ====================== Pagination ======================
    const currentPage = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

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

    // ====================== Count Total Records ======================
    const totalRecords = await Punch.countDocuments({
      user: userId,
      date: { $gte: startDate, $lte: endDate },
    });

    // ====================== Fetch Data ======================
    const attendanceRecords = await Punch.find({
      user: userId,
      date: { $gte: startDate, $lte: endDate },
    })
      .populate("user", "name employeeId department")   // optional but consistent
      .sort({ date: -1, time: -1 })                     // Latest → Oldest
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const totalPages = Math.ceil(totalRecords / pageSize);

    res.status(200).json({
      success: true,
      data: attendanceRecords,
      pagination: {
        totalRecords,
        totalPages,
        currentPage,
        pageSize,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
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
