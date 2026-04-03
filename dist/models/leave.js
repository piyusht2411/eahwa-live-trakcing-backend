"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Leave.ts
const mongoose_1 = require("mongoose");
const leaveSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ["casual", "short", "half-day", "sick", "annual"],
        required: true,
    },
    // Only for type === "short". Stores how many hours (1 or 2) the employee requested.
    shortLeaveDuration: {
        type: Number,
        enum: [1, 2],
        default: null,
    },
    date: {
        type: Date,
        required: true,
    },
    reason: {
        type: String,
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    approvedBy: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
    },
}, { timestamps: true });
const Leave = (0, mongoose_1.model)("Leave", leaveSchema);
exports.default = Leave;
