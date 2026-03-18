"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), taskController_1.getVisits);
router.get("/:id", auth_1.protect, taskController_1.getTaskById);
exports.default = router;
