import { Router } from "express";
import { getVisits } from "../controllers/taskController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "hr", "manager"), getVisits);

export default router;
