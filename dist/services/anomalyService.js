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
exports.detectAnomalies = void 0;
// src/services/anomalyService.ts
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const punch_1 = __importDefault(require("../models/punch"));
const anomaly_1 = __importDefault(require("../models/anomaly"));
const notificationService_1 = require("./notificationService");
const detectAnomalies = (userId, log) => __awaiter(void 0, void 0, void 0, function* () {
    const recentLogs = yield locationlogs_1.default.find({ user: userId }).sort({ timestamp: -1 }).limit(10);
    const recentPunches = yield punch_1.default.find({ user: userId }).sort({ time: -1 }).limit(5);
    // Repeated punch
    if (recentPunches.length > 1 && recentPunches[0].location.lat === recentPunches[1].location.lat && recentPunches[0].type === "in") {
        yield logAnomaly(userId, "repeated_punch", "Same location punch detected");
    }
    // Unrealistic speed
    if (recentLogs.length > 1) {
        const speed = calculateSpeed(recentLogs[0], recentLogs[1]);
        if (speed > 200) { // km/h
            yield logAnomaly(userId, "unrealistic_speed", `Speed: ${speed} km/h`);
        }
    }
    // Excessive idle
    if (recentLogs.length > 1 && (Date.now() - recentLogs[0].timestamp.getTime()) > 3600000) { // 1hr
        yield logAnomaly(userId, "excessive_idle", "No movement for 1 hour");
        yield (0, notificationService_1.sendWhatsAppAlert)("hr_phone", "Idle alert for employee");
    }
    // Short visit (from tasks, assume integrated)
});
exports.detectAnomalies = detectAnomalies;
const logAnomaly = (userId, type, desc) => __awaiter(void 0, void 0, void 0, function* () {
    const anomaly = new anomaly_1.default({ user: userId, type, description: desc });
    yield anomaly.save();
});
const calculateSpeed = (log1, log2) => {
    // Implement
    return 0;
};
