"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const heatmapController_1 = require("../controllers/heatmapController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /api/admin/heatmap
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), heatmapController_1.getHeatmapData);
exports.default = router;
