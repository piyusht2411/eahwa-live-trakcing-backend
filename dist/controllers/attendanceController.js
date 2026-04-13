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
exports.getUserAttendance = exports.getAttendance = void 0;
const punch_1 = __importDefault(require("../models/punch"));
const user_1 = __importDefault(require("../models/user"));
const mongoose_1 = require("mongoose");
const getAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { date, // YYYY-MM-DD (single day)
        year, month, // 1-12
        userId, // filter by specific user
        page = "1", limit = "20" } = req.query;
        const authUser = req.user;
        const adminRoles = ["admin", "super_manager", "hr"];
        const isAdminLevel = adminRoles.includes(authUser.role);
        // ====================== Pagination ======================
        const currentPage = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20)); // max 100 per page
        // ====================== Resolve allowed user IDs for managers ======================
        // Managers only see attendance of employees they manage.
        // Admin / super_manager / hr see everyone.
        let allowedUserIds = null; // null = no restriction
        if (!isAdminLevel) {
            // Manager: fetch only their direct reports
            const teamMembers = yield user_1.default.find({ managedBy: authUser._id, isActive: true }, { _id: 1, name: 1, employeeId: 1 }).lean();
            allowedUserIds = teamMembers.map((u) => u._id);
        }
        // ====================== User Filter ======================
        const userFilter = {};
        if (userId && typeof userId === "string") {
            if (!mongoose_1.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ success: false, message: "Invalid userId" });
            }
            const requestedId = new mongoose_1.Types.ObjectId(userId);
            // If manager, make sure the requested userId is within their team
            if (allowedUserIds !== null && !allowedUserIds.some(id => id.equals(requestedId))) {
                return res.status(403).json({ success: false, message: "Access denied: user not in your team" });
            }
            userFilter.user = requestedId;
        }
        else if (allowedUserIds !== null) {
            // No specific userId requested → restrict to manager's team
            userFilter.user = { $in: allowedUserIds };
        }
        // ====================== Date Filtering Logic ======================
        let startDate;
        let endDate;
        if (date && typeof date === "string") {
            // 1. Single day filter (highest priority)
            const [y, m, d] = date.split("-").map(Number);
            startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
            endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
        }
        else if (year && month) {
            // 2. Full month filter
            const y = parseInt(year);
            const m = parseInt(month) - 1;
            startDate = new Date(y, m, 1, 0, 0, 0, 0);
            endDate = new Date(y, m + 1, 0, 23, 59, 59, 999); // last day of month
        }
        else if (year) {
            // 3. Full year filter
            const y = parseInt(year);
            startDate = new Date(y, 0, 1, 0, 0, 0, 0);
            endDate = new Date(y, 11, 31, 23, 59, 59, 999);
        }
        else {
            // 4. Default → Today
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }
        const query = Object.assign(Object.assign({}, userFilter), { date: { $gte: startDate, $lte: endDate } });
        // ====================== Dropdown users (scoped by role) ======================
        const usersQuery = { isActive: true };
        if (allowedUserIds !== null) {
            usersQuery._id = { $in: allowedUserIds };
        }
        // ====================== Count Total Records + Fetch Users ======================
        const [totalRecords, users] = yield Promise.all([
            punch_1.default.countDocuments(query),
            user_1.default.find(usersQuery, { _id: 1, name: 1, employeeId: 1 }).lean(),
        ]);
        // ====================== Fetch Paginated & Sorted Data ======================
        const attendanceRecords = yield punch_1.default.find(query)
            .populate("user", "name employeeId department")
            .sort({ date: -1, time: -1 }) // ← Latest to oldest
            .skip((currentPage - 1) * pageSize)
            .limit(pageSize)
            .lean();
        // ====================== Pagination Metadata ======================
        const totalPages = Math.ceil(totalRecords / pageSize);
        res.status(200).json({
            success: true,
            data: attendanceRecords, // includes isLate, user details, etc.
            users, // for filter dropdown: [{ _id, name, employeeId }]
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
    }
    catch (error) {
        console.error("Get attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAttendance = getAttendance;
// Add this function below your existing getAttendance
const getUserAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params; // ← From URL
        const { date, // YYYY-MM-DD
        year, month, // 1-12
        page = "1", limit = "20" } = req.query;
        // Basic validation
        if (!userId || !mongoose_1.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid userId" });
        }
        // ====================== Pagination ======================
        const currentPage = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
        // ====================== Date Filtering Logic (same as getAttendance) ======================
        let startDate;
        let endDate;
        if (date && typeof date === "string") {
            const [y, m, d] = date.split("-").map(Number);
            startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
            endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
        }
        else if (year && month) {
            const y = parseInt(year);
            const m = parseInt(month) - 1;
            startDate = new Date(y, m, 1, 0, 0, 0, 0);
            endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
        }
        else if (year) {
            const y = parseInt(year);
            startDate = new Date(y, 0, 1, 0, 0, 0, 0);
            endDate = new Date(y, 11, 31, 23, 59, 59, 999);
        }
        else {
            // Default → Today
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }
        // ====================== Count Total Records ======================
        const totalRecords = yield punch_1.default.countDocuments({
            user: userId,
            date: { $gte: startDate, $lte: endDate },
        });
        // ====================== Fetch Data ======================
        const attendanceRecords = yield punch_1.default.find({
            user: userId,
            date: { $gte: startDate, $lte: endDate },
        })
            .populate("user", "name employeeId department") // optional but consistent
            .sort({ date: -1, time: -1 }) // Latest → Oldest
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
    }
    catch (error) {
        console.error("Get user attendance error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUserAttendance = getUserAttendance;
