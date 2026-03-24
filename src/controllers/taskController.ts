// src/controllers/taskController.ts
import { Request, Response } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import Task from "../models/task";
import User from "../models/user";
import LocationLog from "../models/locationlogs";
import { getRoadDistance } from "../utils/healper";
import { isUserPunchedIn } from "../utils/punchCheck";

const upload = multer({ storage: multer.memoryStorage() });

export const submitTask = [
  upload.array("photos", 10),
  async (req: any, res: Response) => {
    const { date, showroomName, phone, address, stock, feedback, nextOrderPlan } = req.body;
    console.log(req.body);
    const userId = req.user._id;

    const punchedIn = await isUserPunchedIn(userId);
    if (!punchedIn) {
      return res.status(403).json({
        success: false,
        message: "You must be punched in to submit a task"
      });
    }

    try {
      const photos: string[] = [];
      for (const file of req.files) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(file.buffer);
        });
        photos.push((result as any).secure_url);
      }

      const task = new Task({
        user: userId,
        date: new Date(date),
        showroomName,
        phone,
        address: JSON.parse(address),
        photos,
        stock: JSON.parse(stock),
        feedback,
        nextOrderPlan,
        duration: parseInt(req.body.duration) || 0,
      });

      await task.save();

      // Update stock intelligence, performance

      res.status(201).json({ message: "Task submitted", task });
    } catch (error) {
      console.error("Task submit error:", error); // ADD THIS
      res.status(500).json({ message: (error as Error).message || "Error submitting task" });
    }
  },
];

export const getTasks = async (req: any, res: Response) => {
  try {
    const { 
      date,      // YYYY-MM-DD (single day)
      year, 
      month,     // 1-12
      page = "1", 
      limit = "20"
    } = req.query;

    // ====================== Pagination ======================
    const currentPage = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20));

    // ====================== Date Filter Logic ======================
    let startDate: Date;
    let endDate: Date;

    if (date && typeof date === "string") {
      // Single day
      const [y, m, d] = (date as string).split("-").map(Number);
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      endDate   = new Date(y, m - 1, d, 23, 59, 59, 999);
    } 
    else if (year && month) {
      // Full month
      const y = parseInt(year as string);
      const m = parseInt(month as string) - 1;
      startDate = new Date(y, m, 1, 0, 0, 0, 0);
      endDate   = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } 
    else if (year) {
      // Full year
      const y = parseInt(year as string);
      startDate = new Date(y, 0, 1, 0, 0, 0, 0);
      endDate   = new Date(y, 11, 31, 23, 59, 59, 999);
    } 
    else {
      // DEFAULT: TODAY (what you asked)
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    // ====================== Role-based User Filter ======================
    let userFilter: any = {};

    if (req.user.role === "employee") {
      userFilter.user = req.user._id;                    // Only current user
    } 
    else if (req.user.role === "manager") {
      const team = await User.find({ managedBy: req.user._id }).select("_id");
      userFilter.user = { $in: team.map((u: any) => u._id) }; // Entire team
    } 
    else if (req.user.role === "admin") {
      userFilter = {}; // Admin sees everyone (you can restrict if needed)
    }

    // ====================== Build Query ======================
    const query = {
      ...userFilter,
      date: { $gte: startDate, $lte: endDate },
    };

    // ====================== Count + Fetch ======================
    const totalRecords = await Task.countDocuments(query);

    const tasks = await Task.find(query)
      .populate("user", "name employeeId department")
      .sort({ date: -1, createdAt: -1 })   // Latest first
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean();

    const totalPages = Math.ceil(totalRecords / pageSize);

    res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        totalRecords,
        totalPages,
        currentPage,
        pageSize,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
      filters: {
        applied: date ? "day" : year && month ? "month" : year ? "year" : "today",
        date: date || undefined,
        year: year || undefined,
        month: month || undefined,
      },
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getTaskById = async (req: any, res: Response) => {
  try {
    const task = await Task.findById(req.params.id).populate("user", "name employeeId");
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Employees can only view their own tasks
    if (req.user.role === "employee" && task.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Error fetching task" });
  }
};

export const updateTask = [
  upload.array("photos", 10),
  async (req: any, res: Response) => {
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return res.status(404).json({ message: "Task not found" });

      // Only the owner or admin/hr can update
      if (req.user.role === "employee" && task.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (req.user.role === "employee" || req.user.role === "manager") {
        const punchedIn = await isUserPunchedIn(req.user._id);
        if (!punchedIn) {
          return res.status(403).json({
            success: false,
            message: "You must be punched in to edit a task"
          });
        }
      }

      const { date, showroomName, phone, address, stock, feedback, nextOrderPlan } = req.body;

      if (date) task.date = new Date(date);
      if (showroomName) task.showroomName = showroomName;
      if (phone) task.phone = phone;
      if (address) task.address = JSON.parse(address);
      if (stock) task.stock = JSON.parse(stock);
      if (feedback !== undefined) task.feedback = feedback;
      if (nextOrderPlan !== undefined) task.nextOrderPlan = nextOrderPlan;
      if (req.body.duration !== undefined) task.duration = parseInt(req.body.duration);

      if (req.files && (req.files as any[]).length > 0) {
        const newPhotos: string[] = [];
        for (const file of req.files as any[]) {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { resource_type: "auto" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(file.buffer);
          });
          newPhotos.push((result as any).secure_url);
        }
        task.photos = newPhotos;
      }

      await task.save();
      res.json({ message: "Task updated", task });
    } catch (error) {
      console.log(error)
      res.status(500).json({ message: (error as Error).message || "Error updating task" });
    }
  },
];

export const deleteTask = async (req: any, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Only admin/hr or the task owner can delete
    if (req.user.role === "employee" && task.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await task.deleteOne();
    res.json({ message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting task" });
  }
};

export const getVisits = async (req: any, res: Response) => {
  const { employeeName, managerName, month, date } = req.query;

  try {
    let query: any = {};

    if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date as string);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (month) {
      const [year, mon] = (month as string).split("-").map(Number);
      query.date = { $gte: new Date(year, mon - 1, 1), $lte: new Date(year, mon, 0, 23, 59, 59, 999) };
    }

    // Role-based scoping
    if (req.user.role === "manager") {
      const team = await User.find({ managedBy: req.user._id }).select("_id");
      query.user = { $in: team.map((u: any) => u._id) };
    } else if (req.user.role === "employee") {
      query.user = req.user._id;
    }

    const tasks = await Task.find(query)
      .populate({ path: "user", select: "name managedBy", populate: { path: "managedBy", select: "name" } })
      .lean();

    // Group tasks by userId__date, sort each group by time
    const groupMap: Record<string, any[]> = {};
    tasks.forEach((task: any) => {
      const userId = (task.user?._id || task.user)?.toString();
      const dateStr = new Date(task.date).toISOString().split("T")[0];
      const key = `${userId}__${dateStr}`;
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(task);
    });
    for (const key of Object.keys(groupMap)) {
      groupMap[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // For each task compute distance traveled using GPS logs from prev task time → this task time
    const taskDistanceMap: Record<string, number> = {};
    await Promise.all(
      Object.entries(groupMap).map(async ([key, group]) => {
        const [userId, dateStr] = key.split("__");
        const dayStart = new Date(dateStr);
        dayStart.setHours(0, 0, 0, 0);

        for (let i = 0; i < group.length; i++) {
          const task = group[i];
          const segStart = i === 0 ? dayStart : new Date(group[i - 1].date);
          const segEnd   = new Date(task.date);

          const logs = await LocationLog.find({
            user: userId,
            timestamp: { $gte: segStart, $lte: segEnd },
          })
            .sort({ timestamp: 1 })
            .lean();

          const coords = logs.map((l: any) => ({ lat: l.location.lat, lng: l.location.lng, timestamp: l.timestamp }));
          taskDistanceMap[task._id.toString()] = await getRoadDistance(coords);
        }
      })
    );

    let data = tasks.map((task: any) => {
      const user = task.user || {};
      const manager = user.managedBy || {};
      const d = new Date(task.date);
      const dateStr = d.toISOString().split("T")[0];

      return {
        _id: task._id,
        employeeName: user.name || "Unknown",
        managerName: manager.name || "Unknown",
        visitDate: dateStr,
        visitTime: d.toTimeString().slice(0, 5),
        showroomName: task.showroomName,
        address: task.address?.fullAddress || "",
        timeSpent: task.duration || 0,
        distance: taskDistanceMap[task._id.toString()] ?? 0,
        stockUpdated: Array.isArray(task.stock) && task.stock.length > 0,
        totalVehicles: (task.stock || []).reduce((sum: number, s: any) => {
          // only count if it's a scooter item
          return "model" in s && s.model ? sum + (s.quantity || 0) : sum;
        }, 0),
        batteryCount: (task.stock || []).reduce((sum: number, s: any) => {
          // only count if it's a battery item
          return "batteryType" in s && s.batteryType ? sum + (s.batteryQuantity || 0) : sum;
        }, 0),
        photoUrl: task.photos?.[0] || null,
        status: "completed",
      };
    });

    if (employeeName) {
      data = data.filter(v => v.employeeName.toLowerCase().includes((employeeName as string).toLowerCase()));
    }
    if (managerName) {
      data = data.filter(v => v.managerName.toLowerCase().includes((managerName as string).toLowerCase()));
    }

    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching visits" });
  }
};

export const getStock = async (req: any, res: Response) => {
  const { start, end } = req.query;

  try {
    let query: any = {};

    if (start && end) {
      query.date = { $gte: new Date(start as string), $lte: new Date(end as string) };
    }

    // Admins can see all, managers see team
    if (req.user.role === "manager") {
      const team = await User.find({ managedBy: req.user._id }).select("_id");
      query.user = { $in: team.map((u: any) => u._id) };
    }

    const tasks = await Task.find(query)
      .select("stock showroomName date user")
      .populate("user", "name employeeId")
      .lean();

    // Flatten and aggregate the stock arrays from all tasks
    const allStock: any[] = [];

    tasks.forEach(task => {
      if (Array.isArray(task.stock)) {
        task.stock.forEach((item: any) => {
          // Scooter
          if ("model" in item && item.model && (item.quantity || 0) > 0) {
            allStock.push({
              taskId: task._id,
              employee: (task.user as any)?.name || "Unknown",
              showroom: task.showroomName,
              date: task.date,
              item: item.model + (item.variation ? ` (${item.variation})` : ""),
              qty: item.quantity,
              itemType: "scooter",
            });
          }

          // Battery
          if ("batteryType" in item && item.batteryType && (item.batteryQuantity || 0) > 0) {
            allStock.push({
              taskId: task._id,
              employee: (task.user as any)?.name || "Unknown",
              showroom: task.showroomName,
              date: task.date,
              item: `${item.batteryType} Battery`,
              qty: item.batteryQuantity,
              itemType: "battery",
            });
          }
        });
      }
    });

    res.status(200).json({ success: true, data: allStock });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching stock" });
  }
};