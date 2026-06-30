// src/middleware/cronGuard.ts
// Shared guard for endpoints triggered by an external scheduler (e.g. cron-job.org).
// The caller must send the shared secret in the `x-cron-secret` header. If
// CRON_SECRET is not configured the endpoint is refused (fail-closed) so a
// scheduled job can never run unauthenticated in production.
import { Request, Response, NextFunction } from "express";

export const cronGuard = (req: Request, res: Response, next: NextFunction) => {
  const secret = req.headers["x-cron-secret"];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};
