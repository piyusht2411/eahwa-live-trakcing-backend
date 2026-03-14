// src/services/notificationService.ts
import admin from "firebase-admin";

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     }),
//   });
// }

export const sendFCMNotification = async (token: string, title: string, body: string) => {
  await admin.messaging().send({
    token,
    notification: { title, body },
  });
};

// For WhatsApp, assume Twilio integration
import twilio from "twilio";
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

export const sendWhatsAppAlert = async (to: string, message: string) => {
  await client.messages.create({
    from: "whatsapp:" + process.env.TWILIO_WHATSAPP_FROM,
    to: "whatsapp:" + to,
    body: message,
  });
};