"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Only admin and hr can view all users or edit users
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "hr"), userController_1.getAllUsers);
router.get("/:id", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), userController_1.getUserById);
router.put("/:id", auth_1.protect, (0, auth_1.authorize)("admin", "hr"), userController_1.updateUser);
exports.default = router;
