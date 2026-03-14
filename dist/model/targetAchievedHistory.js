"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// targetAchievedHistorySchema.ts
const mongoose_1 = require("mongoose");
const targetAchievedHistorySchema = new mongoose_1.Schema({
    month: {
        type: String,
        required: true,
    },
    total: {
        type: Number,
        default: 0,
    },
    completed: {
        type: Number,
        default: 0,
    },
    pending: {
        type: Number,
        default: 0,
    },
    extra: {
        type: Number,
        default: 0,
    },
});
exports.default = targetAchievedHistorySchema;
