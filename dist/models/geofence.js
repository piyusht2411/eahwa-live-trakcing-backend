"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const geofenceSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    department: { type: String, required: true },
    center: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    radius: { type: Number, required: true, default: 500 }, // 500 meters default
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
const Geofence = (0, mongoose_1.model)("Geofence", geofenceSchema);
exports.default = Geofence;
