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
exports.deleteLeave = exports.getAllEmployeesForFilter = exports.getTeamMembers = exports.getLeaveById = exports.getLeaveHistory = exports.getTeamLeaves = exports.exportLeaves = exports.getAllLeaves = exports.approveLeave = exports.updateLeaveStatus = exports.requestLeave = void 0;
const leave_1 = __importDefault(require("../models/leave"));
const user_1 = __importDefault(require("../models/user"));
const notificationService_1 = require("../services/notificationService");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Build leave summary stats from a list of leave documents.
 * "Taken" counts only approved leaves; pending/rejected are tracked separately.
 */
/**
 * Build leave summary stats.
 * - Casual / half-day counts are all-time.
 * - shortLeaveHours & shortLeaveHoursThisMonth are scoped to the CURRENT MONTH
 *   because the 2-hour allowance resets monthly. Rejected leaves count as 0.
 */
const buildSummary = (leaves, monthlyShortLeaves) => {
    const approved = leaves.filter((l) => l.status === "approved");
    const pending = leaves.filter((l) => l.status === "pending");
    const rejected = leaves.filter((l) => l.status === "rejected");
    // Monthly short leave hours — use the dedicated monthly list if provided,
    // otherwise fall back to the full list (for admin/manager views).
    const shortSource = monthlyShortLeaves !== null && monthlyShortLeaves !== void 0 ? monthlyShortLeaves : leaves;
    const shortLeaveHours = shortSource
        .filter((l) => l.type === "short" && l.status === "approved")
        .reduce((sum, l) => sum + (l.shortLeaveDuration || 0), 0);
    const shortLeavePendingHours = shortSource
        .filter((l) => l.type === "short" && l.status === "pending")
        .reduce((sum, l) => sum + (l.shortLeaveDuration || 0), 0);
    return {
        total: leaves.length,
        totalPending: pending.length,
        totalApproved: approved.length,
        totalRejected: rejected.length,
        casualTaken: approved.filter((l) => l.type === "casual").length,
        halfDayTaken: approved.filter((l) => l.type === "half-day").length,
        // Short leave — monthly scope, approved only
        shortLeaveHours,
        shortLeavePendingHours,
        shortLeaveAllowance: 2, // max hours allowed per month
        shortLeaveRemaining: Math.max(0, 2 - shortLeaveHours),
    };
};
/** Parse and apply common leave list filters to a mongoose query object. */
const buildLeaveQuery = (queryParams) => __awaiter(void 0, void 0, void 0, function* () {
    const { from, to, employeeId, status, type } = queryParams;
    const query = {};
    if (from || to) {
        query.date = {};
        if (from)
            query.date.$gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            query.date.$lte = toDate;
        }
    }
    if (status)
        query.status = status;
    if (type)
        query.type = type;
    if (employeeId) {
        const user = yield user_1.default.findOne({ employeeId: employeeId }).select("_id").lean();
        // If no user found for that employeeId, force 0 results
        query.user = user ? user._id : null;
    }
    return query;
});
/**
 * Counts leave days in an inclusive range, excluding Sundays.
 * Office working days are Mon–Sat, so Sundays don't count against leave.
 */
const countLeaveDays = (start, end) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    if (e < s)
        return 1;
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
        if (cur.getDay() !== 0)
            count++; // 0 = Sunday → skipped
        cur.setDate(cur.getDate() + 1);
    }
    return Math.max(count, 1);
};
// ─── Request Leave ────────────────────────────────────────────────────────────
const requestLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { type, date, endDate, reason, shortLeaveDuration } = req.body;
    const userId = req.user._id;
    try {
        // ── Multi-day (date range) rules ───────────────────────────────────────
        // Only full-day leave types may span multiple days. "short" and "half-day"
        // are intra-day and must stay single-day.
        let normalizedEndDate = null;
        if (endDate) {
            const start = new Date(date);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({ success: false, message: "Invalid date(s)" });
            }
            // Compare by calendar day (ignore time component)
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            if (end.getTime() < start.getTime()) {
                return res.status(400).json({
                    success: false,
                    message: "End date cannot be before the start date",
                });
            }
            if (end.getTime() > start.getTime()) {
                if (type === "short" || type === "half-day") {
                    return res.status(400).json({
                        success: false,
                        message: `${type === "short" ? "Short" : "Half-day"} leave cannot span multiple days`,
                    });
                }
                normalizedEndDate = end;
            }
        }
        // ── Short leave rules ──────────────────────────────────────────────────
        if (type === "short") {
            const employeeType = req.user.employeeType;
            const activeMode = req.user.activeMode;
            const isOfficeEligible = employeeType === "office" ||
                (employeeType === "both" && activeMode === "office");
            if (!isOfficeEligible) {
                return res.status(400).json({
                    success: false,
                    message: "Short leave is only available for office employees",
                });
            }
            const duration = Number(shortLeaveDuration);
            if (duration !== 1 && duration !== 2) {
                return res.status(400).json({
                    success: false,
                    message: "shortLeaveDuration must be 1 or 2 hours",
                });
            }
            // Max 2 hours of short leave per month (pending + approved combined).
            // Rejected leaves do NOT count — the employee can re-apply.
            const requestDate = new Date(date);
            const monthStart = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
            const monthEnd = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0, 23, 59, 59, 999);
            const SHORT_LEAVE_ALLOWANCE = 2; // hours per month
            const activeShortLeaves = yield leave_1.default.find({
                user: userId,
                type: "short",
                status: { $in: ["pending", "approved"] },
                date: { $gte: monthStart, $lte: monthEnd },
            }).select("shortLeaveDuration status").lean();
            const usedHours = activeShortLeaves.reduce((sum, l) => sum + (l.shortLeaveDuration || 0), 0);
            const remainingHours = SHORT_LEAVE_ALLOWANCE - usedHours;
            if (duration > remainingHours) {
                if (remainingHours <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: `You have used all ${SHORT_LEAVE_ALLOWANCE} short leave hours for this month`,
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: `Only ${remainingHours} hour(s) of short leave remaining this month. You requested ${duration} hour(s).`,
                });
            }
        }
        // ── Create leave ───────────────────────────────────────────────────────
        const leave = new leave_1.default(Object.assign({ user: userId, type, date: new Date(date), endDate: normalizedEndDate, reason }, (type === "short" && { shortLeaveDuration: Number(shortLeaveDuration) })));
        yield leave.save();
        // Human-readable span for notifications (e.g. "3-day" leave).
        // Excludes Sundays — office working days are Mon–Sat.
        const dayCount = normalizedEndDate
            ? countLeaveDays(new Date(date), normalizedEndDate)
            : 1;
        // ── Notify manager (save to DB + FCM) ─────────────────────────────────
        if (req.user.managedBy) {
            const manager = yield user_1.default.findById(req.user.managedBy).select("_id fcmToken").lean();
            if (manager) {
                (0, notificationService_1.sendAndSave)(manager._id, manager.fcmToken, "Leave Request", `${req.user.name} has requested ${type === "short" ? `${shortLeaveDuration}-hour short` : dayCount > 1 ? `${dayCount}-day ${type}` : type} leave`, "leave_request", { leaveId: String(leave._id) }).catch(() => { });
            }
        }
        res.status(201).json({ success: true, message: "Leave requested", data: leave });
    }
    catch (error) {
        console.error("Request leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.requestLeave = requestLeave;
// ─── Update Leave Status ──────────────────────────────────────────────────────
const updateLeaveStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { id } = req.params;
    const { status } = req.body;
    const approverId = req.user._id;
    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
    }
    try {
        const leave = yield leave_1.default.findById(id).populate("user", "name fcmToken");
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }
        leave.status = status;
        leave.approvedBy = approverId;
        yield leave.save();
        const employee = leave.user;
        const employeeName = (_a = employee === null || employee === void 0 ? void 0 : employee.name) !== null && _a !== void 0 ? _a : "Employee";
        const leaveLabel = leave.type === "short"
            ? `${leave.shortLeaveDuration}-hour short leave`
            : `${leave.type} leave`;
        const approverRole = req.user.role;
        const notifData = { leaveId: String(leave._id) };
        if (status === "approved") {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Approved", `Your ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            (0, notificationService_1.notifyRoleWithSave)(["hr"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            if (approverRole !== "super_manager") {
                (0, notificationService_1.notifyRoleWithSave)(["super_manager"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            }
        }
        else {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Rejected", `Your ${leave.type} leave request has been rejected`, "leave_rejected", notifData).catch(() => { });
        }
        res.status(200).json({ success: true, message: "Leave updated", data: leave });
    }
    catch (error) {
        console.error("Update leave status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.updateLeaveStatus = updateLeaveStatus;
// ─── Legacy approveLeave ──────────────────────────────────────────────────────
const approveLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { leaveId, status } = req.body;
    try {
        const leave = yield leave_1.default.findById(leaveId).populate("user", "name fcmToken");
        if (!leave)
            return res.status(404).json({ message: "Leave not found" });
        leave.status = status;
        leave.approvedBy = req.user._id;
        yield leave.save();
        const employee = leave.user;
        const employeeName = (_a = employee === null || employee === void 0 ? void 0 : employee.name) !== null && _a !== void 0 ? _a : "Employee";
        const leaveLabel = leave.type === "short"
            ? `${leave.shortLeaveDuration}-hour short leave`
            : `${leave.type} leave`;
        const approverRole = req.user.role;
        const notifData = { leaveId: String(leave._id) };
        if (status === "approved") {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Approved", `Your ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            (0, notificationService_1.notifyRoleWithSave)(["hr"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            if (approverRole !== "super_manager") {
                (0, notificationService_1.notifyRoleWithSave)(["super_manager"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            }
        }
        else {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Rejected", `Your ${leave.type} leave request has been rejected`, "leave_rejected", notifData).catch(() => { });
        }
        res.json({ success: true, message: "Leave updated", data: leave });
    }
    catch (error) {
        console.error("Approve leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.approveLeave = approveLeave;
// ─── GET /api/leaves — Scoped by role + optional month/year filter ───────────
//   manager      → only leaves of employees they manage
//   super_manager / hr / admin → all leaves
const getAllLeaves = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { page = "1", limit = "20", month, year } = req.query;
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (pageNum - 1) * limitNum;
        const query = yield buildLeaveQuery(req.query);
        // ── Month / Year filter ──────────────────────────────────────────────────
        // Accepts ?month=5&year=2026 (1-indexed month).
        // Overrides any from/to already set by buildLeaveQuery.
        if (month || year) {
            const now = new Date();
            const m = month ? parseInt(month) - 1 : now.getMonth(); // 0-indexed
            const y = year ? parseInt(year) : now.getFullYear();
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        // ── Role-based scoping ───────────────────────────────────────────────────
        const role = req.user.role;
        if (role === "manager") {
            // Manager sees only leaves of employees they manage
            const managedUsers = yield user_1.default.find({ managedBy: req.user._id }).select("_id").lean();
            const managedIds = managedUsers.map((u) => u._id);
            if (managedIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    summary: buildSummary([]),
                    pagination: { total: 0, page: pageNum, pages: 0, limit: limitNum },
                });
            }
            // Narrow to managed employees; honour an existing employeeId filter if present
            query.user = query.user
                ? { $in: managedIds.filter((id) => { var _a; return id.toString() === ((_a = query.user) === null || _a === void 0 ? void 0 : _a.toString()); }) }
                : { $in: managedIds };
        }
        // super_manager / hr / admin — no additional user scoping needed
        const [leaves, total, allForSummary] = yield Promise.all([
            leave_1.default.find(query)
                .populate("user", "name employeeId department role employeeType")
                .populate("approvedBy", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            leave_1.default.countDocuments(query),
            leave_1.default.find(query).select("type status shortLeaveDuration").lean(),
        ]);
        // Filter out leaves whose user was deleted (populate returns null for missing refs)
        const validLeaves = leaves.filter((l) => l.user != null);
        res.status(200).json({
            success: true,
            data: validLeaves,
            summary: buildSummary(allForSummary),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    }
    catch (error) {
        console.error("Get all leaves error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllLeaves = getAllLeaves;
// ─── GET /api/leaves/export — Full export for a given month/year (no pagination) ─
//   manager      → only their team's leaves
//   super_manager / hr / admin → all leaves
const exportLeaves = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { month, year } = req.query;
        // ── Month / Year filter (required for export) ────────────────────────────
        const now = new Date();
        const m = month ? parseInt(month) - 1 : now.getMonth(); // 0-indexed
        const y = year ? parseInt(year) : now.getFullYear();
        if (isNaN(m) || m < 0 || m > 11 || isNaN(y)) {
            return res.status(400).json({ success: false, message: "Invalid month or year" });
        }
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const query = { date: { $gte: start, $lte: end } };
        // Honour optional status / type filters
        if (req.query.status)
            query.status = req.query.status;
        if (req.query.type)
            query.type = req.query.type;
        // ── Role-based scoping ───────────────────────────────────────────────────
        const role = req.user.role;
        if (role === "manager") {
            const managedUsers = yield user_1.default.find({ managedBy: req.user._id }).select("_id").lean();
            const managedIds = managedUsers.map((u) => u._id);
            if (managedIds.length === 0) {
                return res.status(200).json({ success: true, data: [], summary: buildSummary([]) });
            }
            query.user = { $in: managedIds };
        }
        // super_manager / hr / admin — no user restriction
        const leaves = yield leave_1.default.find(query)
            .populate("user", "name employeeId department role employeeType")
            .populate("approvedBy", "name")
            .sort({ date: 1, createdAt: -1 })
            .lean();
        const validLeaves = leaves.filter((l) => l.user != null);
        res.status(200).json({
            success: true,
            data: validLeaves,
            summary: buildSummary(validLeaves),
            meta: {
                month: m + 1,
                year: y,
                total: validLeaves.length,
            },
        });
    }
    catch (error) {
        console.error("Export leaves error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.exportLeaves = exportLeaves;
// ─── GET /api/leaves/team — Manager: leaves for employees they manage ─────────
const getTeamLeaves = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (pageNum - 1) * limitNum;
        // Find all employees managed by this manager
        const managedUsers = yield user_1.default.find({ managedBy: req.user._id }).select("_id").lean();
        const managedIds = managedUsers.map((u) => u._id);
        if (managedIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                summary: buildSummary([]),
                pagination: { total: 0, page: pageNum, pages: 0, limit: limitNum },
            });
        }
        const query = yield buildLeaveQuery(req.query);
        // Override/merge user filter — only managed employees
        query.user = query.user
            ? { $in: managedIds.filter((id) => { var _a; return id.toString() === ((_a = query.user) === null || _a === void 0 ? void 0 : _a.toString()); }) }
            : { $in: managedIds };
        const [leaves, total, allForSummary] = yield Promise.all([
            leave_1.default.find(query)
                .populate("user", "name employeeId department employeeType")
                .populate("approvedBy", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            leave_1.default.countDocuments(query),
            leave_1.default.find(query).select("type status shortLeaveDuration").lean(),
        ]);
        // Filter out leaves whose user was deleted (populate returns null for missing refs)
        const validLeaves = leaves.filter((l) => l.user != null);
        res.status(200).json({
            success: true,
            data: validLeaves,
            summary: buildSummary(allForSummary),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    }
    catch (error) {
        console.error("Get team leaves error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTeamLeaves = getTeamLeaves;
// ─── GET /api/leaves/my — Employee's own leave history with summary ───────────
const getLeaveHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (pageNum - 1) * limitNum;
        const query = yield buildLeaveQuery(req.query);
        query.user = req.user._id; // always scoped to the requesting user
        // Scope short leave hours to the current month (allowance resets monthly).
        // All-time query is still used for casual/half-day totals.
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const [leaves, total, allForSummary, monthlyShortLeaves] = yield Promise.all([
            leave_1.default.find(query)
                .populate("approvedBy", "name role") // so employee can see who approved/rejected
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            leave_1.default.countDocuments(query),
            leave_1.default.find({ user: req.user._id }).select("type status shortLeaveDuration").lean(),
            leave_1.default.find({
                user: req.user._id,
                type: "short",
                date: { $gte: monthStart, $lte: monthEnd },
            }).select("type status shortLeaveDuration").lean(),
        ]);
        res.status(200).json({
            success: true,
            data: leaves,
            // All-time totals + current-month short leave balance
            summary: buildSummary(allForSummary, monthlyShortLeaves),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    }
    catch (error) {
        console.error("Get leave history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLeaveHistory = getLeaveHistory;
// ─── GET /api/leaves/:id — Single leave detail ───────────────────────────────
const getLeaveById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    if (!req.user)
        return res.status(401).json({ success: false, message: "Unauthorized" });
    try {
        const leave = yield leave_1.default.findById(req.params.id)
            .populate("user", "name employeeId department role employeeType activeMode")
            .populate("approvedBy", "name role")
            .lean();
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }
        // Employees may only view their own leaves
        if (req.user.role === "employee") {
            const leaveUserId = (_c = (_b = (_a = leave.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) !== null && _c !== void 0 ? _c : (_d = leave.user) === null || _d === void 0 ? void 0 : _d.toString();
            if (leaveUserId !== req.user._id.toString()) {
                return res.status(404).json({ success: false, message: "Leave not found" });
            }
        }
        res.status(200).json({ success: true, data: leave });
    }
    catch (error) {
        console.error("Get leave by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLeaveById = getLeaveById;
// ─── GET /api/leaves/team/members — Manager: list of managed employees ────────
const getTeamMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const members = yield user_1.default.find({ managedBy: req.user._id, isActive: true })
            .select("name employeeId role employeeType")
            .lean();
        res.status(200).json({
            success: true,
            data: members.map((u) => ({
                id: u._id,
                name: u.name,
                employeeId: u.employeeId,
                role: u.role,
                employeeType: u.employeeType,
            })),
        });
    }
    catch (error) {
        console.error("Get team members error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTeamMembers = getTeamMembers;
// ─── GET /api/leaves/employees — HR: list of all employees for filter ─────────
const getAllEmployeesForFilter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const employees = yield user_1.default.find({
            role: { $in: ["employee", "manager", "hr"] },
            isActive: true,
        })
            .select("name employeeId role department employeeType")
            .sort({ name: 1 })
            .lean();
        res.status(200).json({
            success: true,
            data: employees.map((u) => ({
                id: u._id,
                name: u.name,
                employeeId: u.employeeId,
                role: u.role,
                department: u.department,
                employeeType: u.employeeType,
            })),
        });
    }
    catch (error) {
        console.error("Get employees for filter error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllEmployeesForFilter = getAllEmployeesForFilter;
// ─── DELETE ───────────────────────────────────────────────────────────────────
const deleteLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const leave = yield leave_1.default.findById(req.params.id);
        if (!leave)
            return res.status(404).json({ success: false, message: "Leave not found" });
        yield leave.deleteOne();
        res.status(200).json({ success: true, message: "Leave deleted" });
    }
    catch (error) {
        console.error("Delete leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.deleteLeave = deleteLeave;
