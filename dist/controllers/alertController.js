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
exports.getAlerts = void 0;
const alert_1 = __importDefault(require("../models/alert"));
const getAlerts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, status, userId, from, to, limit = "50", page = "1", } = req.query;
        const filter = {};
        // Filter by alert type
        if (type)
            filter.type = type;
        // Filter by resolved status  ?status=resolved | open
        if (status === "resolved")
            filter.resolved = true;
        else if (status === "open")
            filter.resolved = false;
        // Filter by specific user  ?userId=abc123
        if (userId)
            filter.user = userId;
        // Filter by date range  ?from=2024-01-01&to=2024-01-31
        if (from || to) {
            filter.timestamp = {};
            if (from)
                filter.timestamp.$gte = new Date(from);
            if (to)
                filter.timestamp.$lte = new Date(to);
        }
        const pageNum = Math.max(1, parseInt(limit));
        const limitNum = Math.max(1, parseInt(limit));
        const skip = (pageNum - 1) * limitNum;
        const [alerts, total] = yield Promise.all([
            alert_1.default.find(filter)
                .populate("user", "name email phone")
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            alert_1.default.countDocuments(filter),
        ]);
        const data = alerts.map((a) => {
            // Parse offline duration from description e.g. "User offline for 1.25 hours"
            let duration = null;
            if (a.type === "offline_long" && a.description) {
                const match = a.description.match(/([\d.]+)\s*hours?/i);
                if (match)
                    duration = parseFloat(match[1]);
            }
            const user = a.user;
            return {
                _id: a._id,
                employeeName: (user === null || user === void 0 ? void 0 : user.name) || "Unknown",
                employeeEmail: (user === null || user === void 0 ? void 0 : user.email) || null,
                employeePhone: (user === null || user === void 0 ? void 0 : user.phone) || null,
                type: a.type,
                description: a.description, // full human-readable detail
                duration, // hours offline, null for non-offline alerts
                timestamp: a.timestamp,
                status: a.resolved ? "resolved" : "open",
                createdAt: a.createdAt,
            };
        });
        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            data,
        });
    }
    catch (error) {
        console.error("Get alerts error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAlerts = getAlerts;
