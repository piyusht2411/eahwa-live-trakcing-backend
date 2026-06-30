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
exports.getTodayStatus = exports.punch = void 0;
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const punch_1 = __importDefault(require("../models/punch"));
const user_1 = __importDefault(require("../models/user"));
const googleSheetsService_1 = require("../services/googleSheetsService");
const closeStaleSession_1 = require("../utils/closeStaleSession");
const persistTravelDistance_1 = require("../utils/persistTravelDistance");
const alert_1 = __importDefault(require("../models/alert"));
const notificationService_1 = require("../services/notificationService");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.punch = [
    upload.single("selfie"),
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const { type, date, location } = req.body;
        const authReq = req;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a._id;
        if (type === "in") {
            yield (0, closeStaleSession_1.closeStaleSession)(userId);
            // Prevent duplicate punch-in: check if already punched in today with no punch-out after
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const latestPunch = yield punch_1.default.findOne({ user: userId, date: { $gte: today } })
                .sort({ time: -1 })
                .lean();
            if (latestPunch && latestPunch.type === "in") {
                return res.status(400).json({ message: "Already punched in" });
            }
        }
        if (type === "out") {
            // Prevent an orphan punch-out: there must be an OPEN session (latest punch
            // today is an "in") before we accept an "out". Without this guard a client
            // with stale state can record a punch-out with no preceding punch-in, which
            // produces "punch-out before punch-in" rows in the admin attendance table.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const latestPunch = yield punch_1.default.findOne({ user: userId, date: { $gte: today } })
                .sort({ time: -1 })
                .lean();
            if (!latestPunch || latestPunch.type !== "in") {
                return res.status(400).json({ message: "Not punched in" });
            }
        }
        try {
            // Upload selfie
            const selfieResult = yield new Promise((resolve, reject) => {
                cloudinary_1.default.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
                    if (error)
                        reject(error);
                    else
                        resolve(result);
                }).end(req.file.buffer);
            });
            const punch = new punch_1.default({
                user: userId,
                type,
                date: new Date(date),
                time: new Date(),
                location: JSON.parse(location),
                selfie: selfieResult.secure_url,
            });
            yield punch.save();
            // Respond as soon as the punch is persisted. Everything below (distance
            // calc via OSRM, Google Sheet sync, alerts) is secondary and slow — running
            // it before responding is what caused the 30s client timeout. We fire it
            // off after the response so the user gets instant confirmation.
            res.status(201).json({ message: "Punch recorded", punch });
            // ── Background side-effects: never block or fail the punch response ──
            void (() => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e;
                try {
                    // Late punch-in alert — applies to all employee types.
                    if (type === "in" && punch.isLate) {
                        const userName = ((_a = authReq.user) === null || _a === void 0 ? void 0 : _a.name) || String(userId);
                        const description = `${userName} punched in late at ${punch.time.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} IST (after 10:15 AM)`;
                        yield alert_1.default.create({ user: userId, type: "late_arrival", description });
                        if (process.env.HR_WHATSAPP_TO) {
                            (0, notificationService_1.sendAnomalyAlert)(String(userId), userName, "late_arrival", description).catch((err) => console.error("Late punch-in WhatsApp alert failed:", err.message));
                        }
                    }
                    // On punch-out: calculate today's distance and save to user's travelHistory
                    // + Performance (shared with the automatic punch-out paths).
                    if (type === "out") {
                        try {
                            yield (0, persistTravelDistance_1.persistDailyTravelDistance)(String(userId));
                        }
                        catch (err) {
                            console.error("[Punch Out] Failed to save travel distance:", err);
                        }
                    }
                    // Fetch manager name if available
                    let managerName = "";
                    if ((_b = authReq.user) === null || _b === void 0 ? void 0 : _b.managedBy) {
                        const manager = yield user_1.default.findById(authReq.user.managedBy).select("name");
                        managerName = (manager === null || manager === void 0 ? void 0 : manager.name) || "";
                    }
                    // Update Google Sheet
                    yield (0, googleSheetsService_1.updatePunchSheet)({
                        employeeName: (_c = authReq.user) === null || _c === void 0 ? void 0 : _c.name,
                        employeeId: (_d = authReq.user) === null || _d === void 0 ? void 0 : _d.employeeId,
                        department: (_e = authReq.user) === null || _e === void 0 ? void 0 : _e.department,
                        manager: managerName,
                        date: punch.date,
                        time: punch.time,
                        location: punch.location,
                        selfie: punch.selfie,
                        type,
                        isLate: punch.isLate,
                    });
                }
                catch (bgErr) {
                    console.error("[Punch] Background side-effect failed:", bgErr);
                }
            }))();
        }
        catch (error) {
            console.log(error);
            res.status(500).json({ message: "Error" });
        }
    }),
];
const getTodayStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const punches = yield punch_1.default.find({
            user: userId,
            date: { $gte: today, $lt: tomorrow },
        }).sort({ time: 1 });
        let isPunchedIn = false;
        let punchInTime = null;
        let punchOutTime = null;
        let isAutomaticOut = false;
        let isLatePunchIn = false;
        if (punches.length > 0) {
            const firstIn = punches.find((p) => p.type === "in");
            if (firstIn) {
                punchInTime = firstIn.time;
                isLatePunchIn = firstIn.isLate || false;
            }
            const lastOut = [...punches].reverse().find((p) => p.type === "out");
            if (lastOut) {
                punchOutTime = lastOut.time;
                isAutomaticOut = lastOut.isAutomatic || false;
            }
            const lastPunch = punches[punches.length - 1];
            isPunchedIn = lastPunch.type === "in";
        }
        res.status(200).json({
            success: true,
            data: {
                isPunchedIn,
                punchInTime,
                punchOutTime,
                isAutomaticOut,
                isLatePunchIn,
                punchesToday: punches.length,
            },
        });
    }
    catch (error) {
        console.error("Status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTodayStatus = getTodayStatus;
