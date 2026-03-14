"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Holiday.ts
const mongoose_1 = require("mongoose");
const holidaySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
    },
}, { timestamps: true });
const Holiday = (0, mongoose_1.model)("Holiday", holidaySchema);
exports.default = Holiday;
