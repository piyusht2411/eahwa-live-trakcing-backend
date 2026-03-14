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
exports.updateUser = exports.getUserById = exports.getAllUsers = void 0;
const user_1 = __importDefault(require("../models/user"));
const punch_1 = __importDefault(require("../models/punch"));
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const LOCATION_ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
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
    var _a, _b;
    try {
        const { id } = req.params;
        const user = yield user_1.default.findById(id).select("-password").populate("managedBy", "name employeeId email").lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const { start, end } = getTodayRange();
        const [punchesToday, latestLog] = yield Promise.all([
            punch_1.default.find({ user: id, date: { $gte: start, $lte: end } }).sort({ time: 1 }).lean(),
            locationlogs_1.default.findOne({ user: id }).sort({ timestamp: -1 }).lean(),
        ]);
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
            data: Object.assign(Object.assign({}, user), { isPunchedIn, punchInTime: (_a = firstIn === null || firstIn === void 0 ? void 0 : firstIn.time) !== null && _a !== void 0 ? _a : null, punchOutTime: (_b = lastOut === null || lastOut === void 0 ? void 0 : lastOut.time) !== null && _b !== void 0 ? _b : null, lastLocation: latestLog ? { lat: latestLog.location.lat, lng: latestLog.location.lng, timestamp: latestLog.timestamp } : null, locationSharingActive })
        });
    }
    catch (error) {
        console.error("Get user by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUserById = getUserById;
// PUT /api/users/:id
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updateData = req.body;
        // Ensure we don't accidentally hash passwords here if pass isn't handled correctly
        if (updateData.password) {
            delete updateData.password;
        }
        const user = yield user_1.default.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user
        });
    }
    catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.updateUser = updateUser;
