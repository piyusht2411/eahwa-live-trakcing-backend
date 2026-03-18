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
exports.sendWhatsAppAlert = exports.sendFCMNotification = void 0;
// src/services/notificationService.ts
const firebase_admin_1 = __importDefault(require("firebase-admin"));
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.cert({
//       projectId: process.env.FIREBASE_PROJECT_ID,
//       privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
//       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     }),
//   });
// }
const sendFCMNotification = (token, title, body) => __awaiter(void 0, void 0, void 0, function* () {
    yield firebase_admin_1.default.messaging().send({
        token,
        notification: { title, body },
    });
});
exports.sendFCMNotification = sendFCMNotification;
// For WhatsApp, assume Twilio integration
const twilio_1 = __importDefault(require("twilio"));
const client = (0, twilio_1.default)(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const sendWhatsAppAlert = (to, message) => __awaiter(void 0, void 0, void 0, function* () {
    yield client.messages.create({
        from: "whatsapp:" + process.env.TWILIO_WHATSAPP_FROM,
        to: "whatsapp:" + to,
        body: message,
    });
});
exports.sendWhatsAppAlert = sendWhatsAppAlert;
// export const sendWhatsAppTemplate = async (
//   to: string,
//   templateName: string,
//   variables: Record<string, string>
// ) => {
//   await client.messages.create({
//     from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
//     to: `whatsapp:${to}`,
//     template: {
//       name: templateName,
//       language: "en",
//       components: [{ type: "body", parameters: Object.values(variables).map(v => ({ type: "text", text: v })) }]
//     },
//   });
// };
