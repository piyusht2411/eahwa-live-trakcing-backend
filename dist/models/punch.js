"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Punch.ts
const mongoose_1 = require("mongoose");
const punchSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["in", "out"], required: true },
    date: { type: Date, required: true },
    time: { type: Date, required: true },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        address: { type: String, required: true },
    },
    selfie: { type: String, default: null },
    isAutomatic: { type: Boolean, default: false },
    reason: { type: String, default: null },
    verified: { type: Boolean, default: true },
    // ← NEW STORED FIELD
    isLate: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// ← Pre-save middleware: compute isLate automatically (in IST)
punchSchema.pre("save", function (next) {
    var _a, _b;
    if (this.type !== "in") {
        this.isLate = false;
        return next();
    }
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(this.time).reduce((acc, part) => {
        if (part.type === "hour")
            acc.hour = parseInt(part.value, 10);
        if (part.type === "minute")
            acc.minute = parseInt(part.value, 10);
        return acc;
    }, {});
    const hour = (_a = parts.hour) !== null && _a !== void 0 ? _a : 0;
    const minute = (_b = parts.minute) !== null && _b !== void 0 ? _b : 0;
    this.isLate = (hour > 10) || (hour === 10 && minute > 15);
    next();
});
const Punch = (0, mongoose_1.model)("Punch", punchSchema);
exports.default = Punch;
