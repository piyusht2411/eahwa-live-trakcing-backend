"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/models/Task.ts
const mongoose_1 = require("mongoose");
const stockItemSchema = new mongoose_1.Schema({
    model: { type: String, required: true },
    variation: { type: String },
    quantity: { type: Number, required: true },
    batteryStock: { type: Number, required: true },
});
const taskSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Types.ObjectId,
        ref: "User",
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    showroomName: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    address: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        fullAddress: { type: String, required: true },
    },
    photos: [
        {
            type: String, // Cloudinary URLs
        },
    ],
    stock: [stockItemSchema],
    feedback: {
        type: String,
    },
    nextOrderPlan: {
        type: String,
    },
    duration: {
        type: Number, // minutes
    },
}, { timestamps: true });
const Task = (0, mongoose_1.model)("Task", taskSchema);
exports.default = Task;
