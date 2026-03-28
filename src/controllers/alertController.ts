import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Alert from "../models/alert";
import Anomaly from "../models/anomaly";

export const getAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      status,
      userId,
      from,
      to,
      limit = "50",
      page = "1",
    } = req.query;

    const filter: Record<string, any> = {};

    if (type) filter.type = type;

    if (status === "resolved") filter.resolved = true;
    else if (status === "open") filter.resolved = false;

    if (userId) filter.user = userId;

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from as string);
      if (to)   filter.timestamp.$lte = new Date(to as string);
    }

    const pageNum  = Math.max(1, parseInt(page as string));   // was using limit — pagination was broken
    const limitNum = Math.max(1, parseInt(limit as string));
    const skip     = (pageNum - 1) * limitNum;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .populate("user", "name email phone")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Alert.countDocuments(filter),
    ]);

    const data = alerts.map((a) => {
      let duration: number | null = null;
      if (a.type === "offline_long" && a.description) {
        const match = a.description.match(/([\d.]+)\s*hours?/i);
        if (match) duration = parseFloat(match[1]);
      }

      const user = a.user as any;

      return {
        _id:          a._id,
        employeeName: user?.name  || "Unknown",
        employeeEmail:user?.email || null,
        employeePhone:user?.phone || null,
        type:         a.type,
        description:  a.description,
        duration,
        timestamp:    a.timestamp,
        status:       a.resolved ? "resolved" : "open",
        createdAt:    a.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      total,
      page:  pageNum,
      pages: Math.ceil(total / limitNum),
      data,
    });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/anomalies — reads from the Anomaly collection (separate from Alert)
// anomalyService.ts writes here for: unrealistic_speed, repeated_punch, excessive_idle
export const getAnomalies = async (req: AuthRequest, res: Response) => {
  try {
    const {
      type,
      userId,
      from,
      to,
      limit = "50",
      page = "1",
    } = req.query;

    const filter: Record<string, any> = {};

    if (type) filter.type = type;
    if (userId) filter.user = userId;

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from as string);
      if (to)   filter.timestamp.$lte = new Date(to as string);
    }

    const pageNum  = Math.max(1, parseInt(page as string));
    const limitNum = Math.max(1, parseInt(limit as string));
    const skip     = (pageNum - 1) * limitNum;

    const [anomalies, total] = await Promise.all([
      Anomaly.find(filter)
        .populate("user", "name email phone")
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Anomaly.countDocuments(filter),
    ]);

    const data = anomalies.map((a) => {
      const user = a.user as any;
      return {
        _id:          a._id,
        employeeName: user?.name  || "Unknown",
        employeeEmail:user?.email || null,
        employeePhone:user?.phone || null,
        type:         a.type,
        description:  a.description,
        severity:     (a as any).severity ?? "medium",
        timestamp:    a.timestamp,
        createdAt:    (a as any).createdAt,
      };
    });

    res.status(200).json({
      success: true,
      total,
      page:  pageNum,
      pages: Math.ceil(total / limitNum),
      data,
    });
  } catch (error) {
    console.error("Get anomalies error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};