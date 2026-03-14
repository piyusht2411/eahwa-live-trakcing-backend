import { Router } from "express";
import { getAllUsers, getUserById, updateUser } from "../controllers/userController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// Only admin and hr can view all users or edit users
router.get("/", protect, authorize("admin", "hr"), getAllUsers);
router.get("/:id", protect, authorize("admin", "hr", "manager"), getUserById);
router.put("/:id", protect, authorize("admin", "hr"), updateUser);

export default router;
