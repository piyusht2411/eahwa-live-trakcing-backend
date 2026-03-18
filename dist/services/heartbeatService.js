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
exports.checkHeartbeats = void 0;
const user_1 = __importDefault(require("../models/user"));
const punch_1 = __importDefault(require("../models/punch"));
const break_1 = __importDefault(require("../models/break"));
const alert_1 = __importDefault(require("../models/alert"));
const notificationService_1 = require("./notificationService");
const checkHeartbeats = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const THRESHOLD_MINUTES = 20;
        const cutoffTime = new Date(Date.now() - THRESHOLD_MINUTES * 60 * 1000);
        const staleUsers = yield user_1.default.find({
            lastLocationAt: { $lt: cutoffTime, $ne: null },
            role: { $in: ["employee", "manager"] },
        });
        let alertedCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const user of staleUsers) {
            // 1. Must be currently punched in today
            const lastPunch = yield punch_1.default.findOne({
                user: user._id,
                date: { $gte: today },
            }).sort({ time: -1 });
            if (!lastPunch || lastPunch.type !== "in")
                continue;
            // 2. Skip if on an active break
            const activeBreak = yield break_1.default.findOne({
                user: user._id,
                endTime: { $exists: false },
            });
            if (activeBreak)
                continue;
            // 3. Create alert
            yield alert_1.default.create({
                user: user._id,
                type: "location_stopped",
                description: `User stopped sharing location for over ${THRESHOLD_MINUTES} minutes`,
            });
            alertedCount++;
            // 4. FCM → all admins
            const admins = yield user_1.default.find({ role: "admin", fcmToken: { $ne: null } });
            for (const admin of admins) {
                if (!admin.fcmToken)
                    continue;
                try {
                    yield (0, notificationService_1.sendFCMNotification)(admin.fcmToken, "⚠️ Location Sharing Stopped", `${user.name} stopped sending location for over ${THRESHOLD_MINUTES} minutes.`);
                }
                catch (fcmError) {
                    console.error(`FCM failed for admin ${admin._id}:`, fcmError);
                }
            }
            // 5. WhatsApp → HR via template
            if (process.env.HR_WHATSAPP_TO) {
                try {
                    yield (0, notificationService_1.sendLocationStoppedAlert)(String(user._id), user.name, // {{1}}
                    THRESHOLD_MINUTES // {{2}}
                    );
                }
                catch (waError) {
                    console.error(`WhatsApp alert failed for user ${user._id}:`, waError);
                }
            }
        }
        return { success: true, alerted: alertedCount };
    }
    catch (error) {
        console.error("Error checking heartbeats:", error);
        throw error;
    }
});
exports.checkHeartbeats = checkHeartbeats;
