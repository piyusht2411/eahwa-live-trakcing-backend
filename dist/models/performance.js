"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Performance.ts
const mongoose_1 = require("mongoose");
const performanceSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    period: {
        type: String, // "daily", "weekly", "monthly"
        required: true,
    },
    periodStart: {
        type: Date,
        required: true,
    },
    periodEnd: {
        type: Date,
        required: true,
    },
    score: {
        type: Number, // 0-100
        required: true,
    },
    metrics: {
        attendance: { type: Number },
        punctuality: { type: Number },
        visitCount: { type: Number },
        productiveRatio: { type: Number },
        distance: { type: Number },
        taskCompletion: { type: Number },
        breakDiscipline: { type: Number },
        stockConsistency: { type: Number },
    },
}, { timestamps: true });
const Performance = (0, mongoose_1.model)("Performance", performanceSchema);
exports.default = Performance;
