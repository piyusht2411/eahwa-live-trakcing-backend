// src/services/notificationService.ts
import admin from "firebase-admin";
import twilio from "twilio";
import { Types } from "mongoose";
import Notification from "../models/notification";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_WHATSAPP_FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
const HR_WHATSAPP_TO = `whatsapp:${process.env.HR_WHATSAPP_TO}`;

export const sendFCMNotification = async (
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  await admin.messaging().send({
    token,
    notification: { title, body },
    ...(data && { data }),
  });
};

/**
 * Save a notification to the DB + send FCM if the user has a token.
 * Use this instead of bare sendFCMNotification everywhere so history is always recorded.
 */
export const sendAndSave = async (
  userId: Types.ObjectId | string,
  fcmToken: string | null | undefined,
  title: string,
  body: string,
  type: "leave_request" | "leave_approved" | "leave_rejected" | "mode_switch" | "general",
  data?: Record<string, string>
) => {
  // Always persist — even if FCM fails the history is saved
  await Notification.create({ user: userId, title, body, type, ...(data && { data }) });

  if (fcmToken) {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      ...(data && { data }),
    }).catch((err) => console.error(`[FCM] failed for user ${userId}:`, err?.message));
  }
};

/**
 * Find all active users matching the given roles, save a notification for each,
 * and send FCM. Best-effort — individual failures don't throw.
 */
export const notifyRoleWithSave = async (
  roles: string[],
  title: string,
  body: string,
  type: "leave_request" | "leave_approved" | "leave_rejected" | "mode_switch" | "general",
  data?: Record<string, string>
) => {
  // Import here to avoid circular dependency at module load time
  const User = (await import("../models/user")).default;

  const users = await User.find({
    role: { $in: roles },
    isActive: true,
  }).select("_id fcmToken").lean();

  await Promise.allSettled(
    users.map((u: any) => sendAndSave(u._id, u.fcmToken, title, body, type, data))
  );
};

// ── Offline too long ──────────────────────────────────────────────────────────
// Template variables:
//   {{1}} employee name / userId
//   {{2}} offline duration (e.g. "1.25 hours")
export const sendOfflineAlert = async (
  userId: string,
  employeeName: string,
  durationHours: string
): Promise<void> => {
  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: HR_WHATSAPP_TO,
    contentSid: process.env.TWILIO_TEMPLATE_OFFLINE_SID!, // e.g. "HXabc123..."
    contentVariables: JSON.stringify({
      "1": employeeName || userId,
      "2": durationHours,
    }),
  });
};

// ── Device / GPS / Internet alerts ───────────────────────────────────────────
// Template variables:
//   {{1}} employee name / userId
//   {{2}} comma-separated list of active alerts
export const sendDeviceAlert = async (
  userId: string,
  employeeName: string,
  alertDescriptions: string[]
): Promise<void> => {
  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: HR_WHATSAPP_TO,
    contentSid: process.env.TWILIO_TEMPLATE_DEVICE_SID!, // e.g. "HXdef456..."
    contentVariables: JSON.stringify({
      "1": employeeName || userId,
      "2": alertDescriptions.join(", "),
    }),
  });
};

// ── Anomaly alert ─────────────────────────────────────────────────────────────
// Template variables:
//   {{1}} employee name / userId
//   {{2}} anomaly type  (e.g. "unrealistic_speed")
//   {{3}} detail        (e.g. "Speed: 240 km/h")
export const sendAnomalyAlert = async (
  userId: string,
  employeeName: string,
  anomalyType: string,
  detail: string
): Promise<void> => {
  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: HR_WHATSAPP_TO,
    contentSid: process.env.TWILIO_TEMPLATE_ANOMALY_SID!,
    contentVariables: JSON.stringify({
      "1": employeeName || userId,
      "2": anomalyType,
      "3": detail,
    }),
  });
};

// ── Location stopped alert ────────────────────────────────────────────────────
// Template variables:
//   {{1}} employee name
//   {{2}} threshold in minutes (e.g. "20")
export const sendLocationStoppedAlert = async (
  userId: string,
  employeeName: string,
  thresholdMinutes: number
): Promise<void> => {
  await client.messages.create({
    from: TWILIO_WHATSAPP_FROM,
    to: HR_WHATSAPP_TO,
    contentSid: process.env.TWILIO_TEMPLATE_LOCATION_STOPPED_SID!,
    contentVariables: JSON.stringify({
      "1": employeeName || userId,
      "2": thresholdMinutes.toString(),
    }),
  });
};