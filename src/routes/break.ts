import { Router } from "express";
import { startBreak, endBreak, getTodayBreaks, getAllBreaks } from "../controllers/breakController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.post("/start", protect, authorize("employee", "manager", "super_manager", "hr"), startBreak);
router.post("/end", protect, authorize("employee", "manager", "super_manager", "hr"), endBreak);
router.get("/today", protect, authorize("employee", "manager", "super_manager", "hr"), getTodayBreaks);
router.get("/all", protect, authorize("admin", "super_manager", "hr", "manager"), getAllBreaks);

export default router;
