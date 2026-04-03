"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const statsController_1 = require("../controllers/statsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// /api/stats
router.get("/dashboard", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "super_manager", "hr"), statsController_1.getDashboardStats);
exports.default = router;
