"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const notificationSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
        type: String,
        enum: ["leave_request", "leave_approved", "leave_rejected", "mode_switch", "general"],
        required: true,
    },
    // Extra key-value pairs (e.g. leaveId, from, to) used for deep linking / audit
    data: {
        type: Map,
        of: String,
        default: {},
    },
    read: { type: Boolean, default: false },
}, { timestamps: true });
const Notification = (0, mongoose_1.model)("Notification", notificationSchema);
exports.default = Notification;
