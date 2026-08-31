"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const punchController_1 = require("../controllers/punchController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/status", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "super_manager", "hr"), punchController_1.getTodayStatus);
router.post("/", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "super_manager", "hr"), punchController_1.punch);
// Get and Update punch-in location for a user
router.get("/user/:userId/punch-in", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr", "manager"), punchController_1.getTodayPunchIn);
router.post("/user/:userId/punch-in", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr", "manager"), punchController_1.updatePunchInLocation);
exports.default = router;
