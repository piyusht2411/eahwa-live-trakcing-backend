// src/routes/location.ts
import { Router, Request, Response, NextFunction } from "express";
import { logLocation, getLiveTrack, getHeatMap, getTodayLocationHistory, checkHomeIdleUsers } from "../controllers/locationControllers";
import { protect } from "../middleware/auth";
import { hierarchyCheck } from "../middleware/auth";
import rateLimit from "express-rate-limit";

const router = Router();

// Middleware: validates CRON_SECRET header for cron-job.org calls
const cronGuard = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

// Max 5 location logs per 10 seconds per IP — prevents runaway duplicate spam
const locationLogLimiter = rateLimit({
  windowMs: 10_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many location updates, slow down" },
});

router.post("/log", protect, locationLogLimiter, logLocation);
router.get("/home-idle-check", checkHomeIdleUsers);
router.get("/history/:userId", protect, getTodayLocationHistory);
router.get("/:userId", protect, hierarchyCheck, getLiveTrack);
router.get("/heatmap", protect, getHeatMap);

export default router;