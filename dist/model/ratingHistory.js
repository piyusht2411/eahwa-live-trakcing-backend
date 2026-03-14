"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ratingHistorySchema = new mongoose_1.Schema({
    month: {
        type: String,
        required: true,
    },
    managerRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },
    adminRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },
    managerId: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        default: null,
    },
    adminId: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        default: null,
    },
});
exports.default = ratingHistorySchema;
