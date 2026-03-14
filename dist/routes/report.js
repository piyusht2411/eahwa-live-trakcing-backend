"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/report.ts
const express_1 = require("express");
const reportController_1 = require("../controllers/reportController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), reportController_1.generateReport);
exports.default = router;
