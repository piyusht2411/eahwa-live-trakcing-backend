import { Router } from "express";
import { startBreak, endBreak, getTodayBreaks, getAllBreaks } from "../controllers/breakController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.post("/start", protect, authorize("employee"), startBreak);
router.post("/end", protect, authorize("employee"), endBreak);
router.get("/today", protect, authorize("employee"), getTodayBreaks);
router.get("/all", protect, authorize("admin", "hr", "manager"), getAllBreaks);

export default router;
