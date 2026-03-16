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
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.punch = [
    upload.single("selfie"),
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const { type, date, location } = req.body;
        const authReq = req;
        const userId = (_a = authReq.user) === null || _a === void 0 ? void 0 : _a._id;
        if (type === "in") {
            yield (0, closeStaleSession_1.closeStaleSession)(userId);
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
            });
            res.status(201).json({ message: "Punch recorded", punch });
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
        if (punches.length > 0) {
            const firstIn = punches.find((p) => p.type === "in");
            if (firstIn)
                punchInTime = firstIn.time;
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
