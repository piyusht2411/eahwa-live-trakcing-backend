"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.sendLocationStoppedAlert = exports.sendAnomalyAlert = exports.sendDeviceAlert = exports.sendOfflineAlert = exports.notifyRoleWithSave = exports.sendAndSave = exports.sendFCMNotification = void 0;
// src/services/notificationService.ts
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const twilio_1 = __importDefault(require("twilio"));
const notification_1 = __importDefault(require("../models/notification"));
const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_WHATSAPP_FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
const HR_WHATSAPP_TO = `whatsapp:${process.env.HR_WHATSAPP_TO}`;
const sendFCMNotification = (token, title, body, data) => __awaiter(void 0, void 0, void 0, function* () {
    yield firebase_admin_1.default.messaging().send(Object.assign({ token, notification: { title, body } }, (data && { data })));
});
exports.sendFCMNotification = sendFCMNotification;
/**
 * Save a notification to the DB + send FCM if the user has a token.
 * Use this instead of bare sendFCMNotification everywhere so history is always recorded.
 */
const sendAndSave = (userId, fcmToken, title, body, type, data) => __awaiter(void 0, void 0, void 0, function* () {
    // Always persist — even if FCM fails the history is saved
    yield notification_1.default.create(Object.assign({ user: userId, title, body, type }, (data && { data })));
    if (fcmToken) {
        yield firebase_admin_1.default.messaging().send(Object.assign({ token: fcmToken, notification: { title, body } }, (data && { data }))).catch((err) => console.error(`[FCM] failed for user ${userId}:`, err === null || err === void 0 ? void 0 : err.message));
    }
});
exports.sendAndSave = sendAndSave;
/**
 * Find all active users matching the given roles, save a notification for each,
 * and send FCM. Best-effort — individual failures don't throw.
 */
const notifyRoleWithSave = (roles, title, body, type, data) => __awaiter(void 0, void 0, void 0, function* () {
    // Import here to avoid circular dependency at module load time
    const User = (yield Promise.resolve().then(() => __importStar(require("../models/user")))).default;
    const users = yield User.find({
        role: { $in: roles },
        isActive: true,
    }).select("_id fcmToken").lean();
    yield Promise.allSettled(users.map((u) => (0, exports.sendAndSave)(u._id, u.fcmToken, title, body, type, data)));
});
exports.notifyRoleWithSave = notifyRoleWithSave;
// ── Offline too long ──────────────────────────────────────────────────────────
// Template variables:
//   {{1}} employee name / userId
//   {{2}} offline duration (e.g. "1.25 hours")
const sendOfflineAlert = (userId, employeeName, durationHours) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: HR_WHATSAPP_TO,
        contentSid: process.env.TWILIO_TEMPLATE_OFFLINE_SID, // e.g. "HXabc123..."
        contentVariables: JSON.stringify({
            "1": employeeName || userId,
            "2": durationHours,
        }),
    });
});
exports.sendOfflineAlert = sendOfflineAlert;
// ── Device / GPS / Internet alerts ───────────────────────────────────────────
// Template variables:
//   {{1}} employee name / userId
//   {{2}} comma-separated list of active alerts
const sendDeviceAlert = (userId, employeeName, alertDescriptions) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: HR_WHATSAPP_TO,
        contentSid: process.env.TWILIO_TEMPLATE_DEVICE_SID, // e.g. "HXdef456..."
        contentVariables: JSON.stringify({
            "1": employeeName || userId,
            "2": alertDescriptions.join(", "),
        }),
    });
});
exports.sendDeviceAlert = sendDeviceAlert;
// ── Anomaly alert ─────────────────────────────────────────────────────────────
// Template variables:
//   {{1}} employee name / userId
//   {{2}} anomaly type  (e.g. "unrealistic_speed")
//   {{3}} detail        (e.g. "Speed: 240 km/h")
const sendAnomalyAlert = (userId, employeeName, anomalyType, detail) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: HR_WHATSAPP_TO,
        contentSid: process.env.TWILIO_TEMPLATE_ANOMALY_SID,
        contentVariables: JSON.stringify({
            "1": employeeName || userId,
            "2": anomalyType,
            "3": detail,
        }),
    });
});
exports.sendAnomalyAlert = sendAnomalyAlert;
// ── Location stopped alert ────────────────────────────────────────────────────
// Template variables:
//   {{1}} employee name
//   {{2}} threshold in minutes (e.g. "20")
const sendLocationStoppedAlert = (userId, employeeName, thresholdMinutes) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.messages.create({
        from: TWILIO_WHATSAPP_FROM,
        to: HR_WHATSAPP_TO,
        contentSid: process.env.TWILIO_TEMPLATE_LOCATION_STOPPED_SID,
        contentVariables: JSON.stringify({
            "1": employeeName || userId,
            "2": thresholdMinutes.toString(),
        }),
    });
});
exports.sendLocationStoppedAlert = sendLocationStoppedAlert;
