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
exports.deleteUser = exports.switchActiveMode = exports.getUserTravelHistory = exports.updateUser = exports.getAdminsAndManagers = exports.getUsersHomeLocations = exports.getUserById = exports.getAllUsers = void 0;
const user_1 = __importDefault(require("../models/user"));
const punch_1 = __importDefault(require("../models/punch"));
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const performance_1 = __importDefault(require("../models/performance"));
const notification_1 = __importDefault(require("../models/notification"));
const healper_1 = require("../utils/healper");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const LOCATION_ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};
// GET /api/users
const getAllUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, page = "1", limit = "10" } = req.query;
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { employeeId: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }
        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 10;
        const skip = (pageNumber - 1) * limitNumber;
        const users = yield user_1.default.find(query)
            .select("-password")
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 })
            .lean();
        const total = yield user_1.default.countDocuments(query);
        const userIds = users.map((u) => u._id);
        const { start, end } = getTodayRange();
        // Batch: today's punches for all users
        const punchesToday = yield punch_1.default.find({ user: { $in: userIds }, date: { $gte: start, $lte: end } })
            .sort({ time: 1 })
            .lean();
        // Batch: latest location log per user
        const latestLogs = yield locationlogs_1.default.aggregate([
            { $match: { user: { $in: userIds }, timestamp: { $gte: start } } },
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$user", timestamp: { $first: "$timestamp" }, location: { $first: "$location" } } },
        ]);
        // Build lookup maps
        const punchMap = new Map();
        for (const uid of userIds) {
            const userPunches = punchesToday.filter(p => p.user.toString() === uid.toString());
            const firstIn = userPunches.find(p => p.type === "in");
            const lastOut = [...userPunches].reverse().find(p => p.type === "out");
            const last = userPunches[userPunches.length - 1];
            punchMap.set(uid.toString(), {
                isPunchedIn: (last === null || last === void 0 ? void 0 : last.type) === "in" || false,
                punchInTime: (firstIn === null || firstIn === void 0 ? void 0 : firstIn.time) || null,
                punchOutTime: (lastOut === null || lastOut === void 0 ? void 0 : lastOut.time) || null,
            });
        }
        const locationMap = new Map();
        for (const l of latestLogs) {
            locationMap.set(l._id.toString(), Object.assign(Object.assign({}, l.location), { timestamp: l.timestamp }));
        }
        const now = Date.now();
        const data = users.map((u) => {
            var _a, _b, _c;
            const uid = u._id.toString();
            const punch = punchMap.get(uid);
            const loc = locationMap.get(uid);
            return Object.assign(Object.assign({}, u), { isPunchedIn: (_a = punch === null || punch === void 0 ? void 0 : punch.isPunchedIn) !== null && _a !== void 0 ? _a : false, punchInTime: (_b = punch === null || punch === void 0 ? void 0 : punch.punchInTime) !== null && _b !== void 0 ? _b : null, punchOutTime: (_c = punch === null || punch === void 0 ? void 0 : punch.punchOutTime) !== null && _c !== void 0 ? _c : null, lastLocation: loc ? { lat: loc.lat, lng: loc.lng, timestamp: loc.timestamp } : null, locationSharingActive: loc ? (now - new Date(loc.timestamp).getTime()) < LOCATION_ACTIVE_THRESHOLD_MS : false });
        });
        res.status(200).json({
            success: true,
            data,
            pagination: { total, page: pageNumber, pages: Math.ceil(total / limitNumber) }
        });
    }
    catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllUsers = getAllUsers;
// GET /api/users/:id
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        const user = yield user_1.default.findById(id).select("-password").populate("managedBy", "name employeeId email").lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const { start, end } = getTodayRange();
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const [punchesToday, latestLog, latestPerf, todayLocationLogs] = yield Promise.all([
            punch_1.default.find({ user: id, date: { $gte: start, $lte: end } }).sort({ time: 1 }).lean(),
            locationlogs_1.default.findOne({ user: id }).sort({ timestamp: -1 }).lean(),
            performance_1.default.findOne({ user: id, period: "monthly", periodStart: { $gte: monthStart } }).sort({ periodStart: -1 }).lean(),
            locationlogs_1.default.find({ user: id, timestamp: { $gte: start, $lte: end } }).sort({ timestamp: 1 }).select("location timestamp").lean(),
        ]);
        const coords = todayLocationLogs.map((l) => ({ lat: l.location.lat, lng: l.location.lng, timestamp: l.timestamp }));
        const distanceTraveled = yield (0, healper_1.getRoadDistance)(coords);
        const firstIn = punchesToday.find(p => p.type === "in");
        const lastOut = [...punchesToday].reverse().find(p => p.type === "out");
        const lastPunch = punchesToday[punchesToday.length - 1];
        const isPunchedIn = (lastPunch === null || lastPunch === void 0 ? void 0 : lastPunch.type) === "in" || false;
        const now = Date.now();
        const locationSharingActive = latestLog
            ? (now - new Date(latestLog.timestamp).getTime()) < LOCATION_ACTIVE_THRESHOLD_MS
            : false;
        res.status(200).json({
            success: true,
            data: Object.assign(Object.assign({}, user), { isPunchedIn, punchInTime: (_a = firstIn === null || firstIn === void 0 ? void 0 : firstIn.time) !== null && _a !== void 0 ? _a : null, punchOutTime: (_b = lastOut === null || lastOut === void 0 ? void 0 : lastOut.time) !== null && _b !== void 0 ? _b : null, lastLocation: latestLog ? { lat: latestLog.location.lat, lng: latestLog.location.lng, timestamp: latestLog.timestamp } : null, currentLocation: latestLog ? [latestLog.location.lat, latestLog.location.lng] : null, locationSharingActive,
                distanceTraveled, score: (_c = latestPerf === null || latestPerf === void 0 ? void 0 : latestPerf.score) !== null && _c !== void 0 ? _c : null })
        });
    }
    catch (error) {
        console.error("Get user by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUserById = getUserById;
// GET /api/users/home-locations?roles=employee,manager  OR  ?roles[]=employee&roles[]=manager
const getUsersHomeLocations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let roles = [];
        const rolesParam = req.query.roles;
        if (Array.isArray(rolesParam)) {
            // ?roles[]=employee&roles[]=manager
            roles = rolesParam;
        }
        else if (typeof rolesParam === "string") {
            // ?roles=employee,manager  OR  ?roles=employee
            roles = rolesParam.split(",").map(r => r.trim()).filter(Boolean);
        }
        const validRoles = ["admin", "super_manager", "hr", "manager", "employee"];
        const filteredRoles = roles.filter(r => validRoles.includes(r));
        const query = { isActive: true };
        if (filteredRoles.length > 0) {
            query.role = { $in: filteredRoles };
        }
        const users = yield user_1.default.find(query)
            .select("name email employeeId role department phone homeLocation")
            .lean();
        const data = users.map((u) => {
            var _a;
            return ({
                _id: u._id,
                name: u.name,
                email: u.email,
                employeeId: u.employeeId,
                role: u.role,
                department: u.department,
                phone: u.phone,
                homeLocation: (_a = u.homeLocation) !== null && _a !== void 0 ? _a : null,
            });
        });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        console.error("Get users home locations error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUsersHomeLocations = getUsersHomeLocations;
const getAdminsAndManagers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield user_1.default.find({
            role: { $in: ["admin", "super_manager", "manager", "hr"] },
            isActive: true,
        }).select("name _id role").lean();
        const transformedUsers = users.map(user => ({
            id: user._id.toString(),
            name: user.name,
            role: user.role,
        }));
        res.status(200).json({
            success: true,
            data: transformedUsers
        });
    }
    catch (error) {
        console.error("Error fetching admins and managers:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching admins and managers"
        });
    }
});
exports.getAdminsAndManagers = getAdminsAndManagers;
exports.updateUser = [
    upload.single("profilePicture"), // optional file upload
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        const { id } = req.params;
        const updateData = Object.assign({}, req.body);
        try {
            const employee = yield user_1.default.findById(id);
            if (!employee) {
                return res.status(404).json({ message: "Employee not found" });
            }
            // === Upload new profile picture if file is sent ===
            if (req.file) {
                const result = yield new Promise((resolve, reject) => {
                    cloudinary_1.default.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
                        if (error)
                            reject(error);
                        else
                            resolve(result);
                    }).end(req.file.buffer);
                });
                updateData.profilePicture = result.secure_url;
            }
            // === Hash password if provided ===
            if (updateData.password) {
                const salt = yield bcrypt_1.default.genSalt(10);
                updateData.password = yield bcrypt_1.default.hash(updateData.password, salt);
            }
            // === Handle managerId → managedBy mapping (same as register) ===
            if (updateData.managerId !== undefined) {
                updateData.managedBy = updateData.managerId || null;
                delete updateData.managerId;
            }
            // === Auto-assign employeeType for managerial/HR roles when role changes ===
            // Mirrors the pre-save hook logic (bypassed by findByIdAndUpdate).
            const dualRoles = ["manager", "super_manager", "hr"];
            if (updateData.role !== undefined && !updateData.employeeType) {
                const current = yield user_1.default.findById(id).select("employeeType").lean();
                const currentType = current === null || current === void 0 ? void 0 : current.employeeType;
                if (dualRoles.includes(updateData.role) && !currentType) {
                    updateData.employeeType = "both";
                }
            }
            // === Sync activeMode when employeeType changes ===
            // findByIdAndUpdate bypasses pre-save hooks, so we mirror the model logic here.
            if (updateData.employeeType !== undefined) {
                if (updateData.employeeType === "asm") {
                    updateData.activeMode = "asm";
                }
                else if (updateData.employeeType === "office") {
                    updateData.activeMode = "office";
                }
                else if (updateData.employeeType === "both") {
                    if (updateData.activeMode === undefined) {
                        const current = yield user_1.default.findById(id).select("activeMode").lean();
                        updateData.activeMode = (current === null || current === void 0 ? void 0 : current.activeMode) || "office";
                    }
                }
                else if (updateData.employeeType === null) {
                    updateData.activeMode = null;
                }
            }
            // Update (works for both PUT and PATCH)
            const updatedEmployee = yield user_1.default.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true }).select("-password");
            res.status(200).json({
                success: true,
                message: "Employee updated successfully",
                data: updatedEmployee,
            });
        }
        catch (error) {
            console.error("Update employee error:", error);
            // Handle duplicate email error (if email is unique in schema)
            if (error.code === 11000) {
                return res.status(400).json({ message: "Email already exists" });
            }
            res.status(500).json({ message: "Server error" });
        }
    }),
];
// GET /api/users/:id/travel-history?page=1&limit=10&from=2025-01-01&to=2025-03-31
const getUserTravelHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { from, to, page = "1", limit = "10" } = req.query;
        const pageNumber = parseInt(page, 10) || 1;
        const limitNumber = parseInt(limit, 10) || 10;
        const skip = (pageNumber - 1) * limitNumber;
        const user = yield user_1.default.findById(id).select("travelHistory").lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        let history = user.travelHistory;
        // Filter by date range if provided
        if (from || to) {
            const fromDate = from ? new Date(from) : null;
            const toDate = to ? new Date(to) : null;
            if (toDate)
                toDate.setHours(23, 59, 59, 999);
            history = history.filter(entry => {
                const d = new Date(entry.date);
                if (fromDate && d < fromDate)
                    return false;
                if (toDate && d > toDate)
                    return false;
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
    }
    catch (error) {
        console.error("Get travel history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUserTravelHistory = getUserTravelHistory;
// PATCH /api/users/me/active-mode
// Allows a "both" employeeType user to toggle between ASM and office mode from the APK.
const switchActiveMode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = req.user._id;
    const { activeMode } = req.body;
    if (activeMode !== "asm" && activeMode !== "office") {
        return res.status(400).json({ success: false, message: "activeMode must be 'asm' or 'office'" });
    }
    try {
        const user = yield user_1.default.findById(userId).select("employeeType activeMode").lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.employeeType !== "both") {
            return res.status(403).json({
                success: false,
                message: "Only users with employeeType 'both' can switch active mode",
            });
        }
        const previousMode = (_a = user.activeMode) !== null && _a !== void 0 ? _a : "office";
        yield user_1.default.findByIdAndUpdate(userId, { activeMode });
        // Save audit record — admin can query these to see who switched when
        yield notification_1.default.create({
            user: userId,
            title: "Mode Switched",
            body: `Switched from ${previousMode} to ${activeMode} mode`,
            type: "mode_switch",
            data: { from: previousMode, to: activeMode },
        });
        res.status(200).json({ success: true, activeMode });
    }
    catch (error) {
        console.error("Switch active mode error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.switchActiveMode = switchActiveMode;
// ====================== DELETE EMPLOYEE (HARD DELETE) ======================
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const employee = yield user_1.default.findByIdAndDelete(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }
        res.status(200).json({
            success: true,
            message: "Employee deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete employee error:", error);
        res.status(500).json({ message: "Server error" });
    }
});
exports.deleteUser = deleteUser;
