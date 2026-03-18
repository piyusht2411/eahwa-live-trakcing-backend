// src/services/notificationService.ts
import admin from "firebase-admin";
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_WHATSAPP_FROM = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
const HR_WHATSAPP_TO = `whatsapp:${process.env.HR_WHATSAPP_TO}`;

export const sendFCMNotification = async (
  token: string,
  title: string,
  body: string
) => {
  await admin.messaging().send({
    token,
    notification: { title, body },
  });
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