// src/controllers/leaveController.ts
import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Leave from "../models/leave";
import User from "../models/user";
import { sendFCMNotification } from "../services/notificationService";

export const requestLeave = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const { type, date, reason } = req.body;
  const userId = req.user._id;

  try {
    const leave = new Leave({ user: userId, type, date: new Date(date), reason });
    await leave.save();

    // Notify manager/HR
    const manager = await User.findById(req.user.managedBy);
    if (manager) {
      await sendFCMNotification(manager.fcmToken || "", "Leave Request", `${req.user.name} requested ${type} leave`);
    }

    res.status(201).json({ message: "Leave requested" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error" });
  }
};

export const approveLeave = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const { leaveId, status } = req.body;
  const approverId = req.user._id;

  try {
    const leave = await Leave.findById(leaveId).populate("user");
    if (!leave || (req.user.role !== "manager" && req.user.role !== "hr")) {
      return res.status(403).json({ message: "Access denied" });
    }

    leave.status = status;
    leave.approvedBy = approverId;
    await leave.save();

    // Notify employee
    await sendFCMNotification((leave.user as any).fcmToken || "", "Leave Update", `Your leave is ${status}`);

    res.json({ message: "Leave updated" });
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const getLeaveHistory = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  try {
    const leaves = await Leave.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Get leave history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAllLeaves = async (req: Request, res: Response) => {
  try {
    const leaves = await Leave.find()
      .populate("user", "name employeeId department")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Get all leaves error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

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

export const updateLeaveStatus = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const { id } = req.params;
  const { status } = req.body;
  const approverId = req.user._id;

  try {
    const leave = await Leave.findById(id).populate("user");
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    leave.status = status;
    leave.approvedBy = approverId;
    await leave.save();

    const user = leave.user as any;
    if (user?.fcmToken) {
      // Notify employee
      await sendFCMNotification(user.fcmToken, "Leave Update", `Your leave is ${status}`);
    }



    res.status(200).json({ success: true, message: "Leave updated", data: leave });
  } catch (error) {
    console.error("Update leave status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
