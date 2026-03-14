import { Response } from "express";
import { AuthRequest } from "../types/authRequest";
import Geofence from "../models/geofence";

export const createGeofence = async (req: AuthRequest, res: Response) => {
    try {
        const { name, department, center, radius } = req.body;
        const createdBy = req.user?._id;

        const geofence = new Geofence({
            name,
            department,
            center,
            radius,
            createdBy
        });

        await geofence.save();

        res.status(201).json({
            success: true,
            message: "Geofence created successfully",
            data: geofence
        });
    } catch (error) {
        console.error("Create geofence error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getGeofences = async (req: AuthRequest, res: Response) => {
    try {
        const { department } = req.query;
        let query: any = {};

        if (department) {
            query.department = department;
        }

        const geofences = await Geofence.find(query)
            .populate("createdBy", "name employeeId")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: geofences
        });
    } catch (error) {
        console.error("Get geofences error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateGeofence = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const geofence = await Geofence.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        if (!geofence) {
            return res.status(404).json({ success: false, message: "Geofence not found" });
        }

        res.status(200).json({
            success: true,
            message: "Geofence updated successfully",
            data: geofence
        });
    } catch (error) {
        console.error("Update geofence error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
