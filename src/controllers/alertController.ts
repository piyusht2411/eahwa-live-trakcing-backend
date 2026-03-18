import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Alert from "../models/alert";

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

    // Filter by alert type
    if (type) filter.type = type;

    // Filter by resolved status  ?status=resolved | open
    if (status === "resolved") filter.resolved = true;
    else if (status === "open") filter.resolved = false;

    // Filter by specific user  ?userId=abc123
    if (userId) filter.user = userId;

    // Filter by date range  ?from=2024-01-01&to=2024-01-31
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from as string);
      if (to)   filter.timestamp.$lte = new Date(to as string);
    }

    const pageNum  = Math.max(1, parseInt(limit as string));
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
      // Parse offline duration from description e.g. "User offline for 1.25 hours"
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
        description:  a.description,          // full human-readable detail
        duration,                             // hours offline, null for non-offline alerts
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