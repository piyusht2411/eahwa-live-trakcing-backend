"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/LocationLog.ts
const mongoose_1 = require("mongoose");
const locationLogSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
    },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String },
    },
    speed: {
        type: Number, // km/h
    },
    battery: {
        type: Number, // %
    },
    isOffline: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });
// TTL index — configurable via LOCATION_TTL_DAYS env var (default 30 days)
const ttlSeconds = parseInt((_a = process.env.LOCATION_TTL_DAYS) !== null && _a !== void 0 ? _a : "30") * 86400;
locationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlSeconds });
// Compound index for fast history queries (user + timestamp)
locationLogSchema.index({ user: 1, timestamp: -1 });
const LocationLog = (0, mongoose_1.model)("LocationLog", locationLogSchema);
exports.default = LocationLog;
