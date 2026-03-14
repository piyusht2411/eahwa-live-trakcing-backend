// src/routes/leave.ts
import { Router } from "express";
import { requestLeave, approveLeave, getLeaveHistory, getAllLeaves, updateLeaveStatus, deleteLeave } from "../controllers/leaveController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.post("/", protect, authorize("employee"), requestLeave);
router.patch("/approve", protect, authorize("hr", "manager"), approveLeave);
router.get("/history", protect, authorize("employee"), getLeaveHistory);

// Phase 3 Admin endpoints
router.get("/", protect, authorize("admin", "hr", "manager"), getAllLeaves);
router.put("/:id/status", protect, authorize("admin", "hr", "manager"), updateLeaveStatus);
router.delete("/:id", protect, authorize("admin", "hr", "manager"), deleteLeave);

export default router;