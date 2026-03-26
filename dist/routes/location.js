"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/location.ts
const express_1 = require("express");
const locationControllers_1 = require("../controllers/locationControllers");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../middleware/auth");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
// Middleware: validates CRON_SECRET header for cron-job.org calls
const cronGuard = (req, res, next) => {
    const secret = req.headers["x-cron-secret"];
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    next();
};
// Max 5 location logs per 10 seconds per IP — prevents runaway duplicate spam
const locationLogLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many location updates, slow down" },
});
router.post("/log", auth_1.protect, locationLogLimiter, locationControllers_1.logLocation);
router.post("/home-idle-check", cronGuard, locationControllers_1.checkHomeIdleUsers); // secured with cronGuard
router.get("/history/:userId", auth_1.protect, locationControllers_1.getTodayLocationHistory);
router.get("/:userId", auth_1.protect, auth_2.hierarchyCheck, locationControllers_1.getLiveTrack);
router.get("/heatmap", auth_1.protect, locationControllers_1.getHeatMap);
exports.default = router;
