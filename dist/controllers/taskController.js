"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStock = exports.getVisits = exports.deleteTask = exports.updateTask = exports.getTaskById = exports.getTasks = exports.submitTask = void 0;
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const task_1 = __importDefault(require("../models/task"));
const user_1 = __importDefault(require("../models/user"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.submitTask = [
    upload.array("photos", 10),
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { date, showroomName, phone, address, stock, feedback, nextOrderPlan } = req.body;
        console.log(req.body);
        const userId = req.user._id;
        try {
            const photos = [];
            for (const file of req.files) {
                const result = yield new Promise((resolve, reject) => {
                    cloudinary_1.default.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
                        if (error)
                            reject(error);
                        else
                            resolve(result);
                    }).end(file.buffer);
                });
                photos.push(result.secure_url);
            }
            const task = new task_1.default({
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
            yield task.save();
            // Update stock intelligence, performance
            res.status(201).json({ message: "Task submitted", task });
        }
        catch (error) {
            console.error("Task submit error:", error); // ADD THIS
            res.status(500).json({ message: error.message || "Error submitting task" });
        }
    }),
];
const getTasks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(req.user);
    const { userId, start, end } = req.query;
    try {
        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;
        let query = {};
        if (startDate && !isNaN(startDate.getTime()) && endDate && !isNaN(endDate.getTime())) {
            query.date = { $gte: startDate, $lte: endDate };
        }
        if (req.user.role === "manager") {
            const team = yield user_1.default.find({ managedBy: req.user._id }).select("_id");
            query.user = { $in: team.map((u) => u._id) };
        }
        else if (req.user.role === "employee") {
            query.user = req.user._id;
        }
        const tasks = yield task_1.default.find(query).populate("user", "name employeeId");
        res.json(tasks);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error" });
    }
});
exports.getTasks = getTasks;
const getTaskById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const task = yield task_1.default.findById(req.params.id).populate("user", "name employeeId");
        if (!task)
            return res.status(404).json({ message: "Task not found" });
        // Employees can only view their own tasks
        if (req.user.role === "employee" && task.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.json(task);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching task" });
    }
});
exports.getTaskById = getTaskById;
exports.updateTask = [
    upload.array("photos", 10),
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const task = yield task_1.default.findById(req.params.id);
            if (!task)
                return res.status(404).json({ message: "Task not found" });
            // Only the owner or admin/hr can update
            if (req.user.role === "employee" && task.user.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: "Forbidden" });
            }
            const { date, showroomName, phone, address, stock, feedback, nextOrderPlan } = req.body;
            if (date)
                task.date = new Date(date);
            if (showroomName)
                task.showroomName = showroomName;
            if (phone)
                task.phone = phone;
            if (address)
                task.address = JSON.parse(address);
            if (stock)
                task.stock = JSON.parse(stock);
            if (feedback !== undefined)
                task.feedback = feedback;
            if (nextOrderPlan !== undefined)
                task.nextOrderPlan = nextOrderPlan;
            if (req.body.duration !== undefined)
                task.duration = parseInt(req.body.duration);
            if (req.files && req.files.length > 0) {
                const newPhotos = [];
                for (const file of req.files) {
                    const result = yield new Promise((resolve, reject) => {
                        cloudinary_1.default.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
                            if (error)
                                reject(error);
                            else
                                resolve(result);
                        }).end(file.buffer);
                    });
                    newPhotos.push(result.secure_url);
                }
                task.photos = newPhotos;
            }
            yield task.save();
            res.json({ message: "Task updated", task });
        }
        catch (error) {
            console.log(error);
            res.status(500).json({ message: error.message || "Error updating task" });
        }
    }),
];
const deleteTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const task = yield task_1.default.findById(req.params.id);
        if (!task)
            return res.status(404).json({ message: "Task not found" });
        // Only admin/hr or the task owner can delete
        if (req.user.role === "employee" && task.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Forbidden" });
        }
        yield task.deleteOne();
        res.json({ message: "Task deleted" });
    }
    catch (error) {
        res.status(500).json({ message: "Error deleting task" });
    }
});
exports.deleteTask = deleteTask;
const getVisits = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { employeeName, managerName, month, date } = req.query;
    try {
        let query = {};
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        else if (month) {
            const [year, mon] = month.split("-").map(Number);
            query.date = { $gte: new Date(year, mon - 1, 1), $lte: new Date(year, mon, 0, 23, 59, 59, 999) };
        }
        // Role-based scoping
        if (req.user.role === "manager") {
            const team = yield user_1.default.find({ managedBy: req.user._id }).select("_id");
            query.user = { $in: team.map((u) => u._id) };
        }
        else if (req.user.role === "employee") {
            query.user = req.user._id;
        }
        const tasks = yield task_1.default.find(query)
            .populate({ path: "user", select: "name managedBy", populate: { path: "managedBy", select: "name" } })
            .lean();
        let data = tasks.map((task) => {
            var _a, _b;
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
                address: ((_a = task.address) === null || _a === void 0 ? void 0 : _a.fullAddress) || "",
                timeSpent: task.duration || 0,
                distance: 0,
                stockUpdated: Array.isArray(task.stock) && task.stock.length > 0,
                totalVehicles: (task.stock || []).reduce((sum, s) => sum + (s.quantity || 0), 0),
                batteryCount: (task.stock || []).reduce((sum, s) => sum + (s.batteryStock || 0), 0),
                photoUrl: ((_b = task.photos) === null || _b === void 0 ? void 0 : _b[0]) || null,
                status: "completed",
            };
        });
        if (employeeName) {
            data = data.filter(v => v.employeeName.toLowerCase().includes(employeeName.toLowerCase()));
        }
        if (managerName) {
            data = data.filter(v => v.managerName.toLowerCase().includes(managerName.toLowerCase()));
        }
        res.json({ data });
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching visits" });
    }
});
exports.getVisits = getVisits;
const getStock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { start, end } = req.query;
    try {
        let query = {};
        if (start && end) {
            query.date = { $gte: new Date(start), $lte: new Date(end) };
        }
        // Admins can see all, managers see team
        if (req.user.role === "manager") {
            const team = yield user_1.default.find({ managedBy: req.user._id }).select("_id");
            query.user = { $in: team.map((u) => u._id) };
        }
        const tasks = yield task_1.default.find(query)
            .select("stock showroomName date user")
            .populate("user", "name employeeId")
            .lean();
        // Flatten and aggregate the stock arrays from all tasks
        const allStock = [];
        tasks.forEach(task => {
            if (Array.isArray(task.stock)) {
                task.stock.forEach((item) => {
                    var _a, _b;
                    if ((item.quantity || 0) > 0) {
                        allStock.push({
                            taskId: task._id,
                            employee: ((_a = task.user) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
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
                            employee: ((_b = task.user) === null || _b === void 0 ? void 0 : _b.name) || "Unknown",
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Error fetching stock" });
    }
});
exports.getStock = getStock;
