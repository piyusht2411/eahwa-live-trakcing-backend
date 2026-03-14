"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/task.ts
const express_1 = require("express");
const taskController_1 = require("../controllers/taskController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.protect, taskController_1.submitTask);
router.get("/", auth_1.protect, taskController_1.getTasks); // With query params for filter
router.get("/stock", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), taskController_1.getStock);
router.get("/:id", auth_1.protect, taskController_1.getTaskById);
router.put("/:id", auth_1.protect, taskController_1.updateTask);
router.delete("/:id", auth_1.protect, taskController_1.deleteTask);
exports.default = router;
