"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alertController_1 = require("../controllers/alertController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// /api/alerts
router.get("/", auth_1.protect, (0, auth_1.authorize)("employee"), alertController_1.getAlerts);
exports.default = router;
