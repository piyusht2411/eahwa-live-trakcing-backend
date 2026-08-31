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
exports.updatePunchInLocation = exports.getTodayPunchIn = exports.getTodayStatus = exports.punch = void 0;
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const punch_1 = __importDefault(require("../models/punch"));
const user_1 = __importDefault(require("../models/user"));
const googleSheetsService_1 = require("../services/googleSheetsService");
const closeStaleSession_1 = require("../utils/closeStaleSession");
const persistTravelDistance_1 = require("../utils/persistTravelDistance");
const alert_1 = __importDefault(require("../models/alert"));
const notificationService_1 = require("../services/notificationService");
// 12 MB ceiling: a punch selfie is ~200-400 KB after the client downscales it.
// Anything far above that is a misbehaving client, and letting it stream without
// a bound just holds the request open until the client gives up.
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
});
/**
 * A client that lost its connection mid-upload retries the punch. If the first
 * attempt actually landed, the duplicate guards below would reject the retry
 * ("Already punched in" / "Not punched in") even though the punch succeeded,
 * leaving the user stuck. Treat a same-type punch from the last few minutes as
 * the same punch and replay the original response instead.
 */
const RETRY_WINDOW_MS = 3 * 60 * 1000;
const isRecent = (punch) => Date.now() - new Date(punch.time).getTime() < RETRY_WINDOW_MS;
/**
 * Push the selfie to Cloudinary, but never let it hold the punch hostage.
 * Attendance is the record that matters; the selfie is corroboration. If the
 * upload is slower than `timeoutMs` we resolve null, save the punch, and finish
 * the upload in the background.
 */
const uploadSelfie = (buffer) => new Promise((resolve) => {
    cloudinary_1.default.uploader
        .upload_stream({ resource_type: "auto" }, (error, result) => {
        var _a;
        if (error) {
            console.error("[Punch] Cloudinary upload failed:", error.message);
            return resolve(null);
        }
        resolve((_a = result === null || result === void 0 ? void 0 : result.secure_url) !== null && _a !== void 0 ? _a : null);
    })
        .end(buffer);
});
const withTimeout = (promise, timeoutMs) => Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
]);
const SELFIE_UPLOAD_TIMEOUT_MS = 8000;
exports.punch = [
    upload.single("selfie"),
    // Turn multer's rejections (oversized file, malformed multipart) into a clear
    // client error instead of a generic 500 from the global handler.
    (err, _req, res, next) => {
        if (!err)
            return next();
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "Selfie is too large. Please try again." });
        }
        console.error("[Punch] Upload error:", err);
        return res.status(400).json({ message: "Could not read the selfie upload." });
    },
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { type, date, location } = req.body;
        const authReq = req;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a._id;
        if (!((_b = req.file) === null || _b === void 0 ? void 0 : _b.buffer)) {
            return res.status(400).json({ message: "Selfie is required" });
        }
        let parsedLocation;
        try {
            parsedLocation = JSON.parse(location);
        }
        catch (_c) {
            return res.status(400).json({ message: "Invalid location" });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (type === "in") {
            yield (0, closeStaleSession_1.closeStaleSession)(userId);
            // Prevent duplicate punch-in: check if already punched in today with no punch-out after
            const latestPunch = yield punch_1.default.findOne({ user: userId, date: { $gte: today } })
                .sort({ time: -1 })
                .lean();
            if (latestPunch && latestPunch.type === "in") {
                if (isRecent(latestPunch)) {
                    return res.status(201).json({ message: "Punch recorded", punch: latestPunch });
                }
                return res.status(400).json({ message: "Already punched in" });
            }
        }
        if (type === "out") {
            // Prevent an orphan punch-out: there must be an OPEN session (latest punch
            // today is an "in") before we accept an "out". Without this guard a client
            // with stale state can record a punch-out with no preceding punch-in, which
            // produces "punch-out before punch-in" rows in the admin attendance table.
            const latestPunch = yield punch_1.default.findOne({ user: userId, date: { $gte: today } })
                .sort({ time: -1 })
                .lean();
            if (!latestPunch || latestPunch.type !== "in") {
                if ((latestPunch === null || latestPunch === void 0 ? void 0 : latestPunch.type) === "out" && isRecent(latestPunch)) {
                    return res.status(201).json({ message: "Punch recorded", punch: latestPunch });
                }
                return res.status(400).json({ message: "Not punched in" });
            }
        }
        try {
            const selfieBuffer = req.file.buffer;
            const uploadPromise = uploadSelfie(selfieBuffer);
            const selfieUrl = yield withTimeout(uploadPromise, SELFIE_UPLOAD_TIMEOUT_MS);
            const punch = new punch_1.default({
                user: userId,
                type,
                date: new Date(date),
                time: new Date(),
                location: parsedLocation,
                selfie: selfieUrl,
            });
            yield punch.save();
            // Cloudinary was still going when we hit the deadline — let it land and
            // attach the URL afterwards rather than making the user wait for it.
            if (!selfieUrl) {
                void uploadPromise
                    .then((url) => __awaiter(void 0, void 0, void 0, function* () {
                    if (!url)
                        return;
                    yield punch_1.default.updateOne({ _id: punch._id }, { $set: { selfie: url } });
                }))
                    .catch((err) => console.error("[Punch] Late selfie attach failed:", err));
            }
            // Respond as soon as the punch is persisted. Everything below (distance
            // calc via OSRM, Google Sheet sync, alerts) is secondary and slow — running
            // it before responding is what caused the 30s client timeout. We fire it
            // off after the response so the user gets instant confirmation.
            res.status(201).json({ message: "Punch recorded", punch });
            // ── Background side-effects: never block or fail the punch response ──
            void (() => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f;
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
                        selfie: (_f = punch.selfie) !== null && _f !== void 0 ? _f : (yield uploadPromise),
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
            console.error("[Punch] Failed:", error);
            if (!res.headersSent) {
                res.status(500).json({ message: "Error" });
            }
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
const getTodayPunchIn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { userId } = req.params;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        // Try finding today's punch-in first
        let punchIn = yield punch_1.default.findOne({
            user: userId,
            type: "in",
            date: { $gte: today, $lt: tomorrow },
        }).sort({ time: -1 });
        // Fallback to the latest punch-in overall if none found for today
        if (!punchIn) {
            punchIn = yield punch_1.default.findOne({
                user: userId,
                type: "in",
            }).sort({ time: -1 });
        }
        if (!punchIn) {
            return res.status(404).json({ success: false, message: "No punch-in record found for this user" });
        }
        res.status(200).json({
            success: true,
            data: {
                userId: String(punchIn.user),
                punchId: String(punchIn._id),
                lat: (_a = punchIn.location) === null || _a === void 0 ? void 0 : _a.lat,
                lng: (_b = punchIn.location) === null || _b === void 0 ? void 0 : _b.lng,
                address: ((_c = punchIn.location) === null || _c === void 0 ? void 0 : _c.address) || "",
            },
        });
    }
    catch (error) {
        console.error("Get punch-in error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTodayPunchIn = getTodayPunchIn;
const updatePunchInLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { punchId, lat, lng, address } = req.body;
    try {
        let punchRecord;
        if (punchId) {
            punchRecord = yield punch_1.default.findById(punchId);
        }
        else {
            // Fallback: update latest punch-in if punchId is not provided
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            punchRecord = yield punch_1.default.findOne({
                user: userId,
                type: "in",
                date: { $gte: today, $lt: tomorrow },
            }).sort({ time: -1 });
            if (!punchRecord) {
                punchRecord = yield punch_1.default.findOne({
                    user: userId,
                    type: "in",
                }).sort({ time: -1 });
            }
        }
        if (!punchRecord) {
            return res.status(404).json({ success: false, message: "Punch record not found" });
        }
        // Verify user ID matches
        if (String(punchRecord.user) !== userId) {
            return res.status(400).json({ success: false, message: "Punch record does not belong to this user" });
        }
        // Update location
        if (lat !== undefined)
            punchRecord.location.lat = Number(lat);
        if (lng !== undefined)
            punchRecord.location.lng = Number(lng);
        if (address !== undefined)
            punchRecord.location.address = address;
        yield punchRecord.save();
        res.status(200).json({
            success: true,
            message: "Punch-in location updated successfully",
            data: {
                userId: String(punchRecord.user),
                punchId: String(punchRecord._id),
                lat: punchRecord.location.lat,
                lng: punchRecord.location.lng,
                address: punchRecord.location.address,
            },
        });
    }
    catch (error) {
        console.error("Update punch-in error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.updatePunchInLocation = updatePunchInLocation;
