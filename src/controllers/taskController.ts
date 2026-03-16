// src/controllers/taskController.ts
import { Request, Response } from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary";
import Task from "../models/task";
import User from "../models/user";
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
  console.log(req.user);
  const { userId, start, end } = req.query;

  try {
    const startDate = start ? new Date(start as string) : null;
    const endDate = end ? new Date(end as string) : null;

    let query: any = {};
    if (startDate && !isNaN(startDate.getTime()) && endDate && !isNaN(endDate.getTime())) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (req.user.role === "manager") {
      const team = await User.find({ managedBy: req.user._id }).select("_id");
      query.user = { $in: team.map((u: any) => u._id) };
    } else if (req.user.role === "employee") {
      query.user = req.user._id;
    }

    const tasks = await Task.find(query).populate("user", "name employeeId");
    res.json(tasks);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error" });
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

    let data = tasks.map((task: any) => {
      const user = task.user || {};
      const manager = user.managedBy || {};
      const d = new Date(task.date);
      return {
        _id: task._id,
        employeeName: user.name || "Unknown",
        managerName: manager.name || "Unknown",
        visitDate: d.toISOString().split("T")[0],
        visitTime: d.toTimeString().slice(0, 5),
        showroomName: task.showroomName,
        address: task.address?.fullAddress || "",
        timeSpent: task.duration || 0,
        distance: 0,
        stockUpdated: Array.isArray(task.stock) && task.stock.length > 0,
        totalVehicles: (task.stock || []).reduce((sum: number, s: any) => sum + (s.quantity || 0), 0),
        batteryCount: (task.stock || []).reduce((sum: number, s: any) => sum + (s.batteryStock || 0), 0),
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
          if ((item.quantity || 0) > 0) {
            allStock.push({
              taskId: task._id,
              employee: (task.user as any)?.name || "Unknown",
              showroom: task.showroomName,
              date: task.date,
              item: item.model,
              qty: item.quantity,
              itemType: "scooter",
            });
          }
          if ((item.batteryStock || 0) > 0) {
            allStock.push({
              taskId: task._id,
              employee: (task.user as any)?.name || "Unknown",
              showroom: task.showroomName,
              date: task.date,
              item: `${item.model} Battery`,
              qty: item.batteryStock,
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