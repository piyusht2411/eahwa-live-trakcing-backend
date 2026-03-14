import { Router } from "express";
import { createGeofence, getGeofences, updateGeofence } from "../controllers/geofenceController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.post("/", protect, authorize("admin", "hr", "manager"), createGeofence);
router.get("/", protect, authorize("admin", "hr", "manager"), getGeofences);
router.put("/:id", protect, authorize("admin", "hr", "manager"), updateGeofence);

export default router;
