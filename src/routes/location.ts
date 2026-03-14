// src/routes/location.ts
import { Router } from "express";
import { logLocation, getLiveTrack, getHeatMap } from "../controllers/locationControllers";
import { protect } from "../middleware/auth";
import { hierarchyCheck } from "../middleware/auth";

const router = Router();

router.post("/log", protect, logLocation);
router.get("/:userId", protect, hierarchyCheck, getLiveTrack);
router.get("/heatmap", protect, getHeatMap);

export default router;