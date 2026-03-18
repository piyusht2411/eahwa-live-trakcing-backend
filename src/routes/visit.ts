import { Router } from "express";
import { getTaskById, getVisits } from "../controllers/taskController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "hr", "manager"), getVisits);
router.get("/:id", protect, getTaskById);

export default router;
