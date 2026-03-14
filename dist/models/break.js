"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Break.ts
const mongoose_1 = require("mongoose");
const breakSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Types.ObjectId, ref: "User", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    type: { type: String, enum: ["start", "end"] },
    duration: { type: Number }, // auto-calc on end
}, { timestamps: true });
exports.default = (0, mongoose_1.model)("Break", breakSchema);
