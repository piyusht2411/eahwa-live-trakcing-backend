"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const targetAchievedSchema = new mongoose_1.Schema({
    total: {
        type: Number,
        default: 0,
    },
    pending: {
        type: Number,
        default: 0,
    },
    completed: {
        type: Number,
        default: 0,
    },
});
exports.default = targetAchievedSchema;
