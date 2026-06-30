"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronGuard = void 0;
const cronGuard = (req, res, next) => {
    const secret = req.headers["x-cron-secret"];
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    next();
};
exports.cronGuard = cronGuard;
