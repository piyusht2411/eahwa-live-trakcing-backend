"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Anomaly.ts
const mongoose_1 = require("mongoose");
const anomalySchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: [
            "repeated_punch",
            "unrealistic_speed",
            "excessive_idle",
            "short_visit",
            "gps_manipulation",
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
    severity: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
    },
}, { timestamps: true });
const Anomaly = (0, mongoose_1.model)("Anomaly", anomalySchema);
exports.default = Anomaly;
