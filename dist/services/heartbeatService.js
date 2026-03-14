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
const googleSheetsService_1 = require("./googleSheetsService");
const notificationService_1 = require("./notificationService");
const checkHeartbeats = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const THRESHOLD_MINUTES = 2;
        const cutoffTime = new Date(Date.now() - THRESHOLD_MINUTES * 60 * 1000);
        // Find users whose last location update was before the cutoff time
        const staleUsers = yield user_1.default.find({
            lastLocationAt: { $lt: cutoffTime, $ne: null },
            role: { $in: ["employee", "manager"] } // Only check employees and managers
        }).populate("managedBy");
        let autoPunchedOutCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const user of staleUsers) {
            // 1. Check if user is currently punched in today
            const lastPunch = yield punch_1.default.findOne({ user: user._id, date: { $gte: today } }).sort({ time: -1 });
            if (!lastPunch || lastPunch.type !== "in") {
                continue; // Not punched in or already punched out
            }
            // 2. Check if user is currently on an active break
            const activeBreak = yield break_1.default.findOne({ user: user._id, endTime: { $exists: false } });
            if (activeBreak) {
                continue; // User is on a valid break, ignore silence
            }
            // 3. User is punched in, not on break, and hasn't sent location for 20 mins. AUTO PUNCH OUT.
            const now = new Date();
            const autoPunch = new punch_1.default({
                user: user._id,
                type: "out",
                date: now,
                time: now,
                // Use last known location from the in-punch since we don't have current
                location: lastPunch.location,
                isAutomatic: true,
                reason: "Location sharing stopped",
                selfie: null, // No selfie for auto punch-out
            });
            yield autoPunch.save();
            // 4. Create Alert
            yield alert_1.default.create({
                user: user._id,
                type: "location_stopped",
                description: `User stopped sharing location for over ${THRESHOLD_MINUTES} minutes`,
            });
            // 5. Update Google Sheet
            try {
                const manager = user.managedBy;
                yield (0, googleSheetsService_1.updatePunchSheet)({
                    employeeName: user.name,
                    employeeId: user.employeeId,
                    department: user.department,
                    manager: (manager === null || manager === void 0 ? void 0 : manager.name) || "N/A",
                    date: autoPunch.date,
                    time: autoPunch.time,
                    location: autoPunch.location,
                    selfie: null, // handled as "N/A" in googleSheetsService update
                    type: "Auto Punch-Out (Location Stopped)",
                });
            }
            catch (sheetError) {
                console.error("Failed to update Google Sheet for auto punch-out:", sheetError);
            }
            // 6. Notify Admins
            autoPunchedOutCount++;
            const admins = yield user_1.default.find({ role: "admin", fcmToken: { $ne: null } });
            const fcmTokens = admins.map(a => a.fcmToken).filter(Boolean);
            const title = "⚠️ Location Sharing Stopped";
            const body = `${user.name} stopped sending location and was auto punched out.`;
            for (const token of fcmTokens) {
                try {
                    yield (0, notificationService_1.sendFCMNotification)(token, title, body);
                }
                catch (fcmError) {
                    console.error("Failed to send FCM for auto punch-out:", fcmError);
                }
            }
            // WhatsApp to HR if configured
            if (process.env.HR_WHATSAPP_TO) {
                try {
                    yield (0, notificationService_1.sendWhatsAppAlert)(process.env.HR_WHATSAPP_TO, `*Alert*: ${body}`);
                }
                catch (waError) {
                    console.error("Failed to send WA alert:", waError);
                }
            }
        }
        return { success: true, processed: autoPunchedOutCount };
    }
    catch (error) {
        console.error("Error checking heartbeats:", error);
        throw error;
    }
});
exports.checkHeartbeats = checkHeartbeats;
