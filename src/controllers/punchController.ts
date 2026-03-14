// src/controllers/punchController.ts
import { Request, Response } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import Punch from "../models/punch";
import User from "../models/user";
import { updatePunchSheet } from "../services/googleSheetsService";
import { AuthRequest } from "../types/authRequest";

const upload = multer({ storage: multer.memoryStorage() });

export const punch = [
  upload.single("selfie"),
  async (req: any, res: Response) => {
    const { type, date, location } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user?._id;

    try {
      // Upload selfie
      const selfieResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });

      const punch = new Punch({
        user: userId,
        type,
        date: new Date(date),
        time: new Date(),
        location: JSON.parse(location),
        selfie: (selfieResult as any).secure_url,
      });

      await punch.save();

      // Fetch manager name if available
      let managerName = "";
      if (authReq.user?.managedBy) {
        const manager = await User.findById(authReq.user.managedBy).select("name");
        managerName = manager?.name || "";
      }

      // Update Google Sheet
      await updatePunchSheet({
        employeeName: authReq.user?.name,
        employeeId: authReq.user?.employeeId,
        department: authReq.user?.department,
        manager: managerName,
        date: punch.date,
        time: punch.time,
        location: punch.location,
        selfie: punch.selfie,
        type,
      });

      res.status(201).json({ message: "Punch recorded", punch });
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: "Error" });
    }
  },
];

export const getTodayStatus = async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const punches = await Punch.find({
      user: userId,
      date: { $gte: today },
    }).sort({ time: 1 });

    let isPunchedIn = false;
    let punchInTime = null;
    let punchOutTime = null;
    let isAutomaticOut = false;

    if (punches.length > 0) {
      // Find the first punch "in" for the day
      const firstIn = punches.find((p) => p.type === "in");
      if (firstIn) punchInTime = firstIn.time;

      // Find the last punch "out"
      const lastOut = [...punches].reverse().find((p) => p.type === "out");
      if (lastOut) {
        punchOutTime = lastOut.time;
        isAutomaticOut = lastOut.isAutomatic || false;
      }

      // current status depends on the last punch type
      const lastPunch = punches[punches.length - 1];
      isPunchedIn = lastPunch.type === "in";
    }

    res.status(200).json({
      success: true,
      data: {
        isPunchedIn,
        punchInTime,
        punchOutTime,
        isAutomaticOut,
        punchesToday: punches.length,
      },
    });
  } catch (error) {
    console.error("Status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};