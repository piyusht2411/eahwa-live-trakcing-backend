// src/routes/task.ts
import { Router } from "express";
import { submitTask, getTasks, getStock, getTaskById, updateTask, deleteTask } from "../controllers/taskController";
import { protect, authorize } from "../middleware/auth";
import { hierarchyCheck } from "../middleware/auth";

const router = Router();

router.post("/", protect, submitTask);
router.get("/", protect, getTasks); // With query params for filter
router.get("/stock", protect, authorize("admin", "hr", "manager"), getStock);
router.get("/:id", protect, getTaskById);
router.put("/:id", protect, updateTask);
router.delete("/:id", protect, deleteTask);

export default router;