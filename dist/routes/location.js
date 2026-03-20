"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/location.ts
const express_1 = require("express");
const locationControllers_1 = require("../controllers/locationControllers");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Middleware: validates CRON_SECRET header for cron-job.org calls
const cronGuard = (req, res, next) => {
    const secret = req.headers["x-cron-secret"];
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    next();
};
router.post("/log", auth_1.protect, locationControllers_1.logLocation);
router.post("/home-idle-check", locationControllers_1.checkHomeIdleUsers);
router.get("/history/:userId", auth_1.protect, locationControllers_1.getTodayLocationHistory);
router.get("/:userId", auth_1.protect, auth_2.hierarchyCheck, locationControllers_1.getLiveTrack);
router.get("/heatmap", auth_1.protect, locationControllers_1.getHeatMap);
exports.default = router;
