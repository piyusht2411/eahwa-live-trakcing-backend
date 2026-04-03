"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/punch.ts
const express_1 = require("express");
const punchController_1 = require("../controllers/punchController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/status", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "super_manager", "hr"), punchController_1.getTodayStatus);
router.post("/", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "super_manager", "hr"), punchController_1.punch);
exports.default = router;
