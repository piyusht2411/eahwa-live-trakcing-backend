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
exports.persistDailyTravelDistance = void 0;
// src/utils/persistTravelDistance.ts
// Computes a user's road-travel distance for the current day from their location
// logs and persists it to BOTH long-lived stores: User.travelHistory and the
// daily Performance document. Shared by manual punch-out and the automatic
// (inactivity + end-of-day) punch-out paths so auto-closed days still get a
// distance total.
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const user_1 = __importDefault(require("../models/user"));
const performance_1 = __importDefault(require("../models/performance"));
const healper_1 = require("./healper");
const persistDailyTravelDistance = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const locationLogs = yield locationlogs_1.default.find({
        user: userId,
        timestamp: { $gte: today, $lte: endOfDay },
    })
        .sort({ timestamp: 1 })
        .select("location timestamp")
        .lean();
    const coords = locationLogs.map((l) => ({
        lat: l.location.lat,
        lng: l.location.lng,
        timestamp: l.timestamp,
    }));
    // getRoadDistance returns 0 for fewer than 2 points, so this is safe even when
    // the user sent little or no location data.
    const distanceKm = yield (0, healper_1.getRoadDistance)(coords);
    // ── Persist in User.travelHistory (primary long-lived store) ──
    yield user_1.default.findOneAndUpdate({ _id: userId, "travelHistory.date": today }, { $set: { "travelHistory.$.distanceKm": distanceKm } }).then((updated) => __awaiter(void 0, void 0, void 0, function* () {
        if (!updated) {
            yield user_1.default.findByIdAndUpdate(userId, {
                $push: { travelHistory: { date: today, distanceKm } },
            });
        }
    }));
    // ── Also persist in Performance (daily) so reports never lose distance ──
    const perfEndOfDay = new Date(today);
    perfEndOfDay.setHours(23, 59, 59, 999);
    yield performance_1.default.findOneAndUpdate({ user: userId, period: "daily", periodStart: today }, {
        $set: { "metrics.distanceKm": distanceKm },
        // $setOnInsert only runs when MongoDB creates a NEW document (upsert).
        $setOnInsert: { periodEnd: perfEndOfDay, score: 0 },
    }, { upsert: true });
    return distanceKm;
});
exports.persistDailyTravelDistance = persistDailyTravelDistance;
