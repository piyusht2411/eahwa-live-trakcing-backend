import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Alert from "../models/alert";

export const getAlerts = async (req: AuthRequest, res: Response) => {
    try {
        const alerts = await Alert.find()
            .populate("user", "name")
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        const data = alerts.map(a => ({
            _id: a._id,
            employeeName: (a.user as any)?.name || "Unknown",
            type: a.type,
            timestamp: a.timestamp,
            duration: 0,
            status: a.resolved ? "resolved" : "open",
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Get alerts error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
