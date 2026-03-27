import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import User from "../models/user";
import Punch from "../models/punch";
import LocationLog from "../models/locationlogs";
import Performance from "../models/performance";
import { getRoadDistance } from "../utils/healper";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import bcrypt from "bcrypt";

const LOCATION_ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const upload = multer({ storage: multer.memoryStorage() });

const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

// GET /api/users
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const { search, page = "1", limit = "10" } = req.query;

        const query: any = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { employeeId: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const pageNumber = parseInt(page as string, 10) || 1;
        const limitNumber = parseInt(limit as string, 10) || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const users = await User.find(query)
            .select("-password")
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean();

        const total = await User.countDocuments(query);
        const userIds = users.map((u: any) => u._id);
        const { start, end } = getTodayRange();

        // Batch: today's punches for all users
        const punchesToday = await Punch.find({ user: { $in: userIds }, date: { $gte: start, $lte: end } })
            .sort({ time: 1 })
            .lean();

        // Batch: latest location log per user
        const latestLogs = await LocationLog.aggregate([
            { $match: { user: { $in: userIds }, timestamp: { $gte: start } } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$user", timestamp: { $first: "$timestamp" }, location: { $first: "$location" } } },
        ]);

        // Build lookup maps
        const punchMap = new Map<string, { isPunchedIn: boolean; punchInTime: Date | null; punchOutTime: Date | null }>();
        for (const uid of userIds) {
            const userPunches = punchesToday.filter(p => p.user.toString() === uid.toString());
            const firstIn = userPunches.find(p => p.type === "in");
            const lastOut = [...userPunches].reverse().find(p => p.type === "out");
            const last = userPunches[userPunches.length - 1];
            punchMap.set(uid.toString(), {
                isPunchedIn: last?.type === "in" || false,
                punchInTime: firstIn?.time || null,
                punchOutTime: lastOut?.time || null,
            });
        }

        const locationMap = new Map<string, { lat: number; lng: number; timestamp: Date }>();
        for (const l of latestLogs) {
            locationMap.set(l._id.toString(), { ...l.location, timestamp: l.timestamp });
        }

        const now = Date.now();
        const data = users.map((u: any) => {
            const uid = u._id.toString();
            const punch = punchMap.get(uid);
            const loc = locationMap.get(uid);
            return {
                ...u,
                isPunchedIn: punch?.isPunchedIn ?? false,
                punchInTime: punch?.punchInTime ?? null,
                punchOutTime: punch?.punchOutTime ?? null,
                lastLocation: loc ? { lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp } : null,
                locationSharingActive: loc ? (now - new Date(loc.timestamp).getTime()) < LOCATION_ACTIVE_THRESHOLD_MS : false,
            };
        });

        res.status(200).json({
            success: true,
            data,
            pagination: { total, page: pageNumber, pages: Math.ceil(total / limitNumber) }
        });
    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select("-password").populate("managedBy", "name employeeId email").lean();

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const { start, end } = getTodayRange();

        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const [punchesToday, latestLog, latestPerf, todayLocationLogs] = await Promise.all([
            Punch.find({ user: id, date: { $gte: start, $lte: end } }).sort({ time: 1 }).lean(),
            LocationLog.findOne({ user: id }).sort({ timestamp: -1 }).lean(),
            Performance.findOne({ user: id, period: "monthly", periodStart: { $gte: monthStart } }).sort({ periodStart: -1 }).lean(),
            LocationLog.find({ user: id, timestamp: { $gte: start, $lte: end } }).sort({ timestamp: 1 }).select("location timestamp").lean(),
        ]);

        const coords = todayLocationLogs.map((l: any) => ({ lat: l.location.lat, lng: l.location.lng, timestamp: l.timestamp }));
        const distanceTraveled = await getRoadDistance(coords);

        const firstIn = punchesToday.find(p => p.type === "in");
        const lastOut = [...punchesToday].reverse().find(p => p.type === "out");
        const lastPunch = punchesToday[punchesToday.length - 1];
        const isPunchedIn = lastPunch?.type === "in" || false;

        const now = Date.now();
        const locationSharingActive = latestLog
            ? (now - new Date(latestLog.timestamp).getTime()) < LOCATION_ACTIVE_THRESHOLD_MS
            : false;

        res.status(200).json({
            success: true,
            data: {
                ...user,
                isPunchedIn,
                punchInTime: firstIn?.time ?? null,
                punchOutTime: lastOut?.time ?? null,
                lastLocation: latestLog ? { lat: latestLog.location.lat, lng: latestLog.location.lng, timestamp: latestLog.timestamp } : null,
                currentLocation: latestLog ? [latestLog.location.lat, latestLog.location.lng] : null,
                locationSharingActive,
                distanceTraveled,
                score: latestPerf?.score ?? null,
            }
        });
    } catch (error) {
        console.error("Get user by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// GET /api/users/home-locations?roles=employee,manager  OR  ?roles[]=employee&roles[]=manager
export const getUsersHomeLocations = async (req: Request, res: Response) => {
    try {
        let roles: string[] = [];

        const rolesParam = req.query.roles;
        if (Array.isArray(rolesParam)) {
            // ?roles[]=employee&roles[]=manager
            roles = rolesParam as string[];
        } else if (typeof rolesParam === "string") {
            // ?roles=employee,manager  OR  ?roles=employee
            roles = rolesParam.split(",").map(r => r.trim()).filter(Boolean);
        }

        const validRoles = ["admin", "hr", "manager", "employee"];
        const filteredRoles = roles.filter(r => validRoles.includes(r));

        const query: any = { isActive: true };
        if (filteredRoles.length > 0) {
            query.role = { $in: filteredRoles };
        }

        const users = await User.find(query)
            .select("name email employeeId role department phone homeLocation")
            .lean();

        const data = users.map((u: any) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            employeeId: u.employeeId,
            role: u.role,
            department: u.department,
            phone: u.phone,
            homeLocation: u.homeLocation ?? null,
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Get users home locations error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getAdminsAndManagers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ 
      role: { $in: ["admin", "manager"] },
      isActive: true // Optional: Only active users
    }).select("name _id").lean(); // Use lean() for better performance since we only need basic fields

    // Transform to include a display label for the frontend select (name + ID for clarity)
    const transformedUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.name
    }));

    res.status(200).json({
      success: true,
      data: transformedUsers
    });
  } catch (error) {
    console.error("Error fetching admins and managers:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error while fetching admins and managers" 
    });
  }
}

export const updateUser = [
  upload.single("profilePicture"), // optional file upload
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: any = { ...req.body };

    try {
      const employee = await User.findById(id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // === Upload new profile picture if file is sent ===
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

        updateData.profilePicture = (result as any).secure_url;
      }

      // === Hash password if provided ===
      if (updateData.password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(updateData.password, salt);
      }

      // === Handle managerId → managedBy mapping (same as register) ===
      if (updateData.managerId !== undefined) {
        updateData.managedBy = updateData.managerId;
        delete updateData.managerId;
      }

      // Update (works for both PUT and PATCH)
      const updatedEmployee = await User.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select("-password");

      res.status(200).json({
        success: true,
        message: "Employee updated successfully",
        data: updatedEmployee,
      });
    } catch (error: any) {
      console.error("Update employee error:", error);

      // Handle duplicate email error (if email is unique in schema)
      if (error.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }

      res.status(500).json({ message: "Server error" });
    }
  },
];

// GET /api/users/:id/travel-history?page=1&limit=10&from=2025-01-01&to=2025-03-31
export const getUserTravelHistory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { from, to, page = "1", limit = "10" } = req.query;

        const pageNumber = parseInt(page as string, 10) || 1;
        const limitNumber = parseInt(limit as string, 10) || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const user = await User.findById(id).select("travelHistory").lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let history = (user as any).travelHistory as { date: Date; distanceKm: number }[];

        // Filter by date range if provided
        if (from || to) {
            const fromDate = from ? new Date(from as string) : null;
            const toDate = to ? new Date(to as string) : null;
            if (toDate) toDate.setHours(23, 59, 59, 999);

            history = history.filter(entry => {
                const d = new Date(entry.date);
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                return true;
            });
        }

        // Sort newest first
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const total = history.length;
        const paginated = history.slice(skip, skip + limitNumber);

        res.status(200).json({
            success: true,
            data: paginated,
            pagination: {
                total,
                page: pageNumber,
                pages: Math.ceil(total / limitNumber),
            },
        });
    } catch (error) {
        console.error("Get travel history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ====================== DELETE EMPLOYEE (HARD DELETE) ======================
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const employee = await User.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
