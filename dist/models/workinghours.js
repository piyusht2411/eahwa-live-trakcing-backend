"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/WorkingHours.ts
const mongoose_1 = require("mongoose");
const workingHoursSchema = new mongoose_1.Schema({
    department: { type: String, required: true },
    startTime: { type: String, required: true }, // e.g., "09:00"
    endTime: { type: String, required: true },
    breakType: { type: String, enum: ["fixed", "flexible"], required: true },
    maxBreakDuration: { type: Number }, // minutes
});
exports.default = (0, mongoose_1.model)("WorkingHours", workingHoursSchema);
