// src/controllers/authController.ts
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import User from "../models/user";
import Performance from "../models/performance";
import { AuthRequest } from "../types/authRequest";

const upload = multer({ storage: multer.memoryStorage() });

export const register = [
  upload.single("profilePicture"),   // ← multer middleware (optional field)
  async (req: Request, res: Response) => {
    const {
      name, email, password, role, department, phone,
      managerId, aadhaarNumber, address, employeeId, post,
      homeLat, homeLng, homeAddress, mapColor, employeeType
    } = req.body;


    let profilePicture = "";

    try {
      // === Upload profile picture to Cloudinary (if file sent) ===
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file!.buffer);
        });

        profilePicture = (result as any).secure_url;
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User exists" });
      }

      const homeLocation: any = {};
      if (homeLat != null) {
        const latNum = parseFloat(homeLat as any);
        if (!isNaN(latNum)) homeLocation.lat = latNum;
      }
      if (homeLng != null) {
        const lngNum = parseFloat(homeLng as any);
        if (!isNaN(lngNum)) homeLocation.lng = lngNum;
      }
      if (homeAddress != null) {
        homeLocation.address = homeAddress;
      }

      // Roles that are treated as employees (get employeeId, can have leaves/attendance)
      const employeeRoles = ["manager", "super_manager", "hr", "employee"];

      const user = new User({
        name,
        email,
        password,
        role,
        department,
        phone,
        profilePicture,
        ...(aadhaarNumber && { aadhaarNumber }),
        ...(address && { address }),
        ...(employeeId && { employeeId }),
        ...(post && { post }),
        ...(managerId && { managedBy: managerId }),
        ...(Object.keys(homeLocation).length > 0 && { homeLocation }),
        ...(mapColor && { mapColor }),
        // employeeType can be passed explicitly; if omitted the pre-save hook assigns
        // "both" for manager/super_manager/hr and leaves employee as-is (must be provided for employees)
        ...(employeeRoles.includes(role) && employeeType && { employeeType }),
      });

      await user.save();

      // Auto-generate employeeId for all employee-type roles
      if (employeeRoles.includes(role) && !user.employeeId) {
        user.employeeId = `EMP${Date.now()}`;
        await user.save();
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "", {
        expiresIn: "30d",
      });

      res.status(201).json({
        token,
        user: {
          id: user._id,
          name,
          email,
          role,
          employeeType: user.employeeType ?? null,
          activeMode: user.activeMode ?? null,
          department,
          phone,
          profilePicture,
          managerId,
          aadhaarNumber,
          address,
          employeeId: user.employeeId,
          post,
          homeLocation: user.homeLocation || null,
        },
      });
    } catch (error) {
      console.log("Register error:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
];

export const updateFcmToken = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const { fcmToken } = req.body;
  if (!fcmToken || typeof fcmToken !== "string") {
    return res.status(400).json({ message: "fcmToken required" });
  }
  await User.findByIdAndUpdate(req.user._id, { fcmToken });
  res.json({ success: true });
};

export const login = async (req: Request, res: Response) => {
  const { userName, password, fcmToken } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: userName }, { employeeId: userName }],
    }).select("+password").populate<{ managedBy: { _id: any; name: string } | null }>("managedBy", "name");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let needsSave = false;

    if (fcmToken && typeof fcmToken === "string" && fcmToken.length > 10 && fcmToken.length < 200) {
      user.fcmToken = fcmToken;
      needsSave = true;
    }

    if (!user.mapColor) {
      const MAP_COLORS = [
        "#E63946", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
        "#00BCD4", "#F44336", "#3F51B5", "#8BC34A", "#FF5722",
        "#607D8B", "#E91E63", "#009688", "#FFC107", "#673AB7",
        "#03A9F4", "#CDDC39", "#FF4081", "#00ACC1", "#7B1FA2",
      ];
      // Pick based on user creation time to spread colors across users
      const index = Math.abs(String(user._id).split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)) % MAP_COLORS.length;
      user.mapColor = MAP_COLORS[index];
      needsSave = true;
    }

    if (needsSave) {
      await user.save({ validateBeforeSave: false });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "", {
      expiresIn: "30d",
    });

    const manager = user.managedBy as any;

    // Fetch today's performance score and rank
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayPerf = await Performance.findOne({
      user: user._id,
      period: "daily",
      periodStart: { $gte: todayStart },
    }).sort({ periodStart: -1 });

    let score: number | null = todayPerf?.score ?? null;
    let rank: number | null = null;

    if (score !== null) {
      // Rank = how many employees scored strictly higher + 1
      const higherCount = await Performance.countDocuments({
        period: "daily",
        periodStart: { $gte: todayStart },
        score: { $gt: score },
      });
      rank = higherCount + 1;
    }

    res.status(200).json({
      ok: true,
      message: "User login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeType: user.employeeType ?? null,
        activeMode: user.activeMode ?? null,
        profilePicture: user.profilePicture || "",
        department: user.department,
        phone: user.phone,
        aadhaarNumber: user.aadhaarNumber,
        address: user.address,
        employeeId: user.employeeId,
        post: user.post,
        managedBy: manager ? { id: manager._id, name: manager.name } : null,
        joiningDate: user.joiningDate,
        score,
        rank,
        homeLocation: user.homeLocation || null,
        mapColor: user.mapColor,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};