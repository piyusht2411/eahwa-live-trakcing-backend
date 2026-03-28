"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Alert.ts
const mongoose_1 = require("mongoose");
const alertSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: [
            "gps_disabled",
            "internet_disabled",
            "device_off",
            "no_movement",
            "offline_long",
            "late_arrival",
            "location_stopped",
        ],
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    resolved: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });
const Alert = (0, mongoose_1.model)("Alert", alertSchema);
exports.default = Alert;
