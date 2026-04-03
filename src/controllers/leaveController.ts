// src/controllers/leaveController.ts
import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Leave from "../models/leave";
import User from "../models/user";
import { sendAndSave, notifyRoleWithSave } from "../services/notificationService";

// ─── Helpers ──────────────────────────────────────────────────────────────────


/**
 * Build leave summary stats from a list of leave documents.
 * "Taken" counts only approved leaves; pending/rejected are tracked separately.
 */
const buildSummary = (leaves: any[]) => {
  const approved = leaves.filter((l) => l.status === "approved");
  const pending  = leaves.filter((l) => l.status === "pending");
  const rejected = leaves.filter((l) => l.status === "rejected");

  return {
    total:           leaves.length,
    totalPending:    pending.length,
    totalApproved:   approved.length,
    totalRejected:   rejected.length,
    casualTaken:     approved.filter((l) => l.type === "casual").length,
    shortLeaveHours: approved
      .filter((l) => l.type === "short")
      .reduce((sum: number, l: any) => sum + (l.shortLeaveDuration || 0), 0),
    halfDayTaken:    approved.filter((l) => l.type === "half-day").length,
  };
};

/** Parse and apply common leave list filters to a mongoose query object. */
const buildLeaveQuery = async (queryParams: any): Promise<any> => {
  const { from, to, employeeId, status, type } = queryParams;
  const query: any = {};

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from as string);
    if (to) {
      const toDate = new Date(to as string);
      toDate.setHours(23, 59, 59, 999);
      query.date.$lte = toDate;
    }
  }

  if (status)     query.status = status;
  if (type)       query.type   = type;

  if (employeeId) {
    const user = await User.findOne({ employeeId: employeeId as string }).select("_id").lean();
    // If no user found for that employeeId, force 0 results
    query.user = user ? (user as any)._id : null;
  }

  return query;
};

// ─── Request Leave ────────────────────────────────────────────────────────────

export const requestLeave = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { type, date, reason, shortLeaveDuration } = req.body;
  const userId = req.user._id;

  try {
    // ── Short leave rules ──────────────────────────────────────────────────
    if (type === "short") {
      const employeeType = req.user.employeeType;
      const activeMode   = req.user.activeMode;

      const isOfficeEligible =
        employeeType === "office" ||
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

      // Max 1 short leave per month
      const requestDate = new Date(date);
      const monthStart  = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
      const monthEnd    = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const existingShortLeave = await Leave.findOne({
        user: userId,
        type: "short",
        date: { $gte: monthStart, $lte: monthEnd },
      });

      if (existingShortLeave) {
        return res.status(400).json({
          success: false,
          message: "You have already used your short leave for this month",
        });
      }
    }

    // ── Create leave ───────────────────────────────────────────────────────
    const leave = new Leave({
      user: userId,
      type,
      date: new Date(date),
      reason,
      ...(type === "short" && { shortLeaveDuration: Number(shortLeaveDuration) }),
    });

    await leave.save();

    // ── Notify manager (save to DB + FCM) ─────────────────────────────────
    if (req.user.managedBy) {
      const manager = await User.findById(req.user.managedBy).select("_id fcmToken").lean();
      if (manager) {
        sendAndSave(
          (manager as any)._id,
          (manager as any).fcmToken,
          "Leave Request",
          `${req.user.name} has requested ${type === "short" ? `${shortLeaveDuration}-hour short` : type} leave`,
          "leave_request",
          { leaveId: String(leave._id) }
        ).catch(() => {});
      }
    }

    res.status(201).json({ success: true, message: "Leave requested", data: leave });
  } catch (error) {
    console.error("Request leave error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Update Leave Status ──────────────────────────────────────────────────────

export const updateLeaveStatus = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.params;
  const { status } = req.body;
  const approverId = req.user._id;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
  }

  try {
    const leave = await Leave.findById(id).populate<{ user: any }>("user", "name fcmToken");
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    leave.status    = status;
    leave.approvedBy = approverId;
    await leave.save();

    const employee: any     = leave.user;
    const employeeName: string = employee?.name ?? "Employee";
    const leaveLabel = leave.type === "short"
      ? `${leave.shortLeaveDuration}-hour short leave`
      : `${leave.type} leave`;

    const approverRole = req.user.role;
    const notifData = { leaveId: String(leave._id) };

    if (status === "approved") {
      sendAndSave(employee._id, employee?.fcmToken, "Leave Approved", `Your ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => {});
      notifyRoleWithSave(["hr"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => {});
      if (approverRole !== "super_manager") {
        notifyRoleWithSave(["super_manager"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => {});
      }
    } else {
      sendAndSave(employee._id, employee?.fcmToken, "Leave Rejected", `Your ${leave.type} leave request has been rejected`, "leave_rejected", notifData).catch(() => {});
    }

    res.status(200).json({ success: true, message: "Leave updated", data: leave });
  } catch (error) {
    console.error("Update leave status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Legacy approveLeave ──────────────────────────────────────────────────────

export const approveLeave = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { leaveId, status } = req.body;

  try {
    const leave = await Leave.findById(leaveId).populate<{ user: any }>("user", "name fcmToken");
    if (!leave) return res.status(404).json({ message: "Leave not found" });

    leave.status     = status;
    leave.approvedBy = req.user._id;
    await leave.save();

    const employee: any        = leave.user;
    const employeeName: string = employee?.name ?? "Employee";
    const leaveLabel = leave.type === "short"
      ? `${leave.shortLeaveDuration}-hour short leave`
      : `${leave.type} leave`;

    const approverRole = req.user.role;
    const notifData    = { leaveId: String(leave._id) };

    if (status === "approved") {
      sendAndSave(employee._id, employee?.fcmToken, "Leave Approved", `Your ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => {});
      notifyRoleWithSave(["hr"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => {});
      if (approverRole !== "super_manager") {
        notifyRoleWithSave(["super_manager"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => {});
      }
    } else {
      sendAndSave(employee._id, employee?.fcmToken, "Leave Rejected", `Your ${leave.type} leave request has been rejected`, "leave_rejected", notifData).catch(() => {});
    }

    res.json({ success: true, message: "Leave updated", data: leave });
  } catch (error) {
    console.error("Approve leave error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/leaves — Admin / Super Manager / HR: all leaves ────────────────

export const getAllLeaves = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum  = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip     = (pageNum - 1) * limitNum;

    const query = await buildLeaveQuery(req.query);

    const [leaves, total, allForSummary] = await Promise.all([
      Leave.find(query)
        .populate("user", "name employeeId department role employeeType")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Leave.countDocuments(query),
      Leave.find(query).select("type status shortLeaveDuration").lean(),
    ]);

    res.status(200).json({
      success: true,
      data: leaves,
      summary: buildSummary(allForSummary),
      pagination: {
        total,
        page:  pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get all leaves error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/leaves/team — Manager: leaves for employees they manage ─────────

export const getTeamLeaves = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum  = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip     = (pageNum - 1) * limitNum;

    // Find all employees managed by this manager
    const managedUsers = await User.find({ managedBy: req.user._id }).select("_id").lean();
    const managedIds   = managedUsers.map((u: any) => u._id);

    if (managedIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        summary: buildSummary([]),
        pagination: { total: 0, page: pageNum, pages: 0, limit: limitNum },
      });
    }

    const query = await buildLeaveQuery(req.query);
    // Override/merge user filter — only managed employees
    query.user = query.user
      ? { $in: managedIds.filter((id: any) => id.toString() === query.user?.toString()) }
      : { $in: managedIds };

    const [leaves, total, allForSummary] = await Promise.all([
      Leave.find(query)
        .populate("user", "name employeeId department employeeType")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Leave.countDocuments(query),
      Leave.find(query).select("type status shortLeaveDuration").lean(),
    ]);

    res.status(200).json({
      success: true,
      data: leaves,
      summary: buildSummary(allForSummary),
      pagination: {
        total,
        page:  pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get team leaves error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/leaves/my — Employee's own leave history with summary ───────────

export const getLeaveHistory = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum  = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const skip     = (pageNum - 1) * limitNum;

    const query = await buildLeaveQuery(req.query);
    query.user  = req.user._id; // always scoped to the requesting user

    const [leaves, total, allForSummary] = await Promise.all([
      Leave.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Leave.countDocuments(query),
      Leave.find({ user: req.user._id }).select("type status shortLeaveDuration").lean(),
    ]);

    res.status(200).json({
      success: true,
      data: leaves,
      // Summary is always for ALL time (not just filtered page) so the employee sees their full balance
      summary: buildSummary(allForSummary),
      pagination: {
        total,
        page:  pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get leave history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/leaves/:id — Single leave detail ───────────────────────────────

export const getLeaveById = async (req: Request, res: Response) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate("user", "name employeeId department role employeeType activeMode")
      .populate("approvedBy", "name role")
      .lean();

    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    res.status(200).json({ success: true, data: leave });
  } catch (error) {
    console.error("Get leave by id error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/leaves/team/members — Manager: list of managed employees ────────

export const getTeamMembers = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const members = await User.find({ managedBy: req.user._id, isActive: true })
      .select("name employeeId role employeeType")
      .lean();

    res.status(200).json({
      success: true,
      data: members.map((u: any) => ({
        id:           u._id,
        name:         u.name,
        employeeId:   u.employeeId,
        role:         u.role,
        employeeType: u.employeeType,
      })),
    });
  } catch (error) {
    console.error("Get team members error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/leaves/employees — HR: list of all employees for filter ─────────

export const getAllEmployeesForFilter = async (req: Request, res: Response) => {
  try {
    const employees = await User.find({
      role: { $in: ["employee", "manager", "hr"] },
      isActive: true,
    })
      .select("name employeeId role department employeeType")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: employees.map((u: any) => ({
        id:           u._id,
        name:         u.name,
        employeeId:   u.employeeId,
        role:         u.role,
        department:   u.department,
        employeeType: u.employeeType,
      })),
    });
  } catch (error) {
    console.error("Get employees for filter error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const deleteLeave = async (req: Request, res: Response) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });
    await leave.deleteOne();
    res.status(200).json({ success: true, message: "Leave deleted" });
  } catch (error) {
    console.error("Delete leave error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
