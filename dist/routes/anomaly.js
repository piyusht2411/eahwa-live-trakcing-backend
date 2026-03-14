"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alertController_1 = require("../controllers/alertController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Alias /api/anomalies to the existing getAlerts controller
// Since the frontend considers critical alerts as 'anomalies'
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), alertController_1.getAlerts);
exports.default = router;
