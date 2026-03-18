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
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const healper_1 = require("../utils/healper");
const punchCheck_1 = require("../utils/punchCheck");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.submitTask = [
    upload.array("photos", 10),
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { date, showroomName, phone, address, stock, feedback, nextOrderPlan } = req.body;
        console.log(req.body);
        const userId = req.user._id;
        const punchedIn = yield (0, punchCheck_1.isUserPunchedIn)(userId);
        if (!punchedIn) {
            return res.status(403).json({
                success: false,
                message: "You must be punched in to submit a task"
            });
        }
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
    try {
        const { date, // YYYY-MM-DD (single day)
        year, month, // 1-12
        page = "1", limit = "20" } = req.query;
        // ====================== Pagination ======================
        const currentPage = Math.max(1, parseInt(page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
        // ====================== Date Filter Logic ======================
        let startDate;
        let endDate;
        if (date && typeof date === "string") {
            // Single day
            const [y, m, d] = date.split("-").map(Number);
            startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
            endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
        }
        else if (year && month) {
            // Full month
            const y = parseInt(year);
            const m = parseInt(month) - 1;
            startDate = new Date(y, m, 1, 0, 0, 0, 0);
            endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
        }
        else if (year) {
            // Full year
            const y = parseInt(year);
            startDate = new Date(y, 0, 1, 0, 0, 0, 0);
            endDate = new Date(y, 11, 31, 23, 59, 59, 999);
        }
        else {
            // DEFAULT: TODAY (what you asked)
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }
        // ====================== Role-based User Filter ======================
        let userFilter = {};
        if (req.user.role === "employee") {
            userFilter.user = req.user._id; // Only current user
        }
        else if (req.user.role === "manager") {
            const team = yield user_1.default.find({ managedBy: req.user._id }).select("_id");
            userFilter.user = { $in: team.map((u) => u._id) }; // Entire team
        }
        else if (req.user.role === "admin") {
            userFilter = {}; // Admin sees everyone (you can restrict if needed)
        }
        // ====================== Build Query ======================
        const query = Object.assign(Object.assign({}, userFilter), { date: { $gte: startDate, $lte: endDate } });
        // ====================== Count + Fetch ======================
        const totalRecords = yield task_1.default.countDocuments(query);
        const tasks = yield task_1.default.find(query)
            .populate("user", "name employeeId department")
            .sort({ date: -1, createdAt: -1 }) // Latest first
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
    }
    catch (error) {
        console.error("Get tasks error:", error);
        res.status(500).json({ success: false, message: "Server error" });
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
            if (req.user.role === "employee" || req.user.role === "manager") {
                const punchedIn = yield (0, punchCheck_1.isUserPunchedIn)(req.user._id);
                if (!punchedIn) {
                    return res.status(403).json({
                        success: false,
                        message: "You must be punched in to edit a task"
                    });
                }
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
        // Build per-user per-date distance map from LocationLogs
        const userDateKeys = new Set();
        tasks.forEach((task) => {
            var _a, _b;
            const userId = (_b = (((_a = task.user) === null || _a === void 0 ? void 0 : _a._id) || task.user)) === null || _b === void 0 ? void 0 : _b.toString();
            const dateStr = new Date(task.date).toISOString().split("T")[0];
            if (userId)
                userDateKeys.add(`${userId}__${dateStr}`);
        });
        const distanceMap = {};
        yield Promise.all(Array.from(userDateKeys).map((key) => __awaiter(void 0, void 0, void 0, function* () {
            const [userId, dateStr] = key.split("__");
            const start = new Date(dateStr);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateStr);
            end.setHours(23, 59, 59, 999);
            const logs = yield locationlogs_1.default.find({ user: userId, timestamp: { $gte: start, $lte: end } })
                .sort({ timestamp: 1 })
                .lean();
            let total = 0;
            for (let i = 1; i < logs.length; i++) {
                total += (0, healper_1.haversineDistance)(logs[i - 1].location.lat, logs[i - 1].location.lng, logs[i].location.lat, logs[i].location.lng);
            }
            distanceMap[key] = parseFloat(total.toFixed(2));
        })));
        let data = tasks.map((task) => {
            var _a, _b, _c;
            const user = task.user || {};
            const manager = user.managedBy || {};
            const d = new Date(task.date);
            const userId = (_a = (user._id || task.user)) === null || _a === void 0 ? void 0 : _a.toString();
            const dateStr = d.toISOString().split("T")[0];
            return {
                _id: task._id,
                employeeName: user.name || "Unknown",
                managerName: manager.name || "Unknown",
                visitDate: dateStr,
                visitTime: d.toTimeString().slice(0, 5),
                showroomName: task.showroomName,
                address: ((_b = task.address) === null || _b === void 0 ? void 0 : _b.fullAddress) || "",
                timeSpent: task.duration || 0,
                distance: distanceMap[`${userId}__${dateStr}`] || 0,
                stockUpdated: Array.isArray(task.stock) && task.stock.length > 0,
                totalVehicles: (task.stock || []).reduce((sum, s) => {
                    // only count if it's a scooter item
                    return "model" in s && s.model ? sum + (s.quantity || 0) : sum;
                }, 0),
                batteryCount: (task.stock || []).reduce((sum, s) => {
                    // only count if it's a battery item
                    return "batteryType" in s && s.batteryType ? sum + (s.batteryQuantity || 0) : sum;
                }, 0),
                photoUrl: ((_c = task.photos) === null || _c === void 0 ? void 0 : _c[0]) || null,
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
                    // Scooter
                    if ("model" in item && item.model && (item.quantity || 0) > 0) {
                        allStock.push({
                            taskId: task._id,
                            employee: ((_a = task.user) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
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
                            employee: ((_b = task.user) === null || _b === void 0 ? void 0 : _b.name) || "Unknown",
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Error fetching stock" });
    }
});
exports.getStock = getStock;
