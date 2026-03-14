"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Punch.ts
const mongoose_1 = require("mongoose");
const punchSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ["in", "out"],
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    time: {
        type: Date,
        required: true,
    },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String, required: true },
    },
    selfie: {
        type: String, // Cloudinary URL
        default: null,
    },
    isAutomatic: {
        type: Boolean,
        default: false,
    },
    reason: {
        type: String,
        default: null,
    },
    verified: {
        type: Boolean,
        default: true, // Auto-verified, admin can override
    },
}, { timestamps: true });
const Punch = (0, mongoose_1.model)("Punch", punchSchema);
exports.default = Punch;
