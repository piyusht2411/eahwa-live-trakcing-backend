import express, { Request, Response } from "express";
import { checkHeartbeats } from "../services/heartbeatService";

const router = express.Router();

router.get("/check", async (req: Request, res: Response) => {
  try {
    const cronSecret = req.headers["x-cron-secret"];
    // Optional: if a secret is defined in env, enforce it. Otherwise, allow (for testing).
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await checkHeartbeats();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Error checking heartbeats" });
  }
});

export default router;
