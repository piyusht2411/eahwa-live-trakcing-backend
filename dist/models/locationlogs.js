"use strict";
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
// TTL index to delete after 1 day (86400 seconds)
locationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
const LocationLog = (0, mongoose_1.model)("LocationLog", locationLogSchema);
exports.default = LocationLog;
