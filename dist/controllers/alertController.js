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
exports.getAlerts = void 0;
const alert_1 = __importDefault(require("../models/alert"));
const getAlerts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const alerts = yield alert_1.default.find()
            .populate("user", "name")
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();
        const data = alerts.map(a => {
            var _a;
            return ({
                _id: a._id,
                employeeName: ((_a = a.user) === null || _a === void 0 ? void 0 : _a.name) || "Unknown",
                type: a.type,
                timestamp: a.timestamp,
                duration: 0,
                status: a.resolved ? "resolved" : "open",
            });
        });
        res.status(200).json({ success: true, data });
    }
    catch (error) {
        console.error("Get alerts error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAlerts = getAlerts;
