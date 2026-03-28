"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const heartbeatService_1 = require("../services/heartbeatService");
const router = express_1.default.Router();
router.get("/check", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cronSecret = req.headers["x-cron-secret"];
        // Optional: if a secret is defined in env, enforce it. Otherwise, allow (for testing).
        if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const result = yield (0, heartbeatService_1.checkHeartbeats)();
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: "Error checking heartbeats" });
    }
}));
// Fires no_movement alert when employee is sharing location but hasn't moved
// from the same spot for 60+ minutes. Schedule this cron every 30 minutes.
router.get("/long-stationary-check", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cronSecret = req.headers["x-cron-secret"];
        if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const result = yield (0, heartbeatService_1.checkLongStationary)();
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ message: "Error checking long stationary" });
    }
}));
exports.default = router;
