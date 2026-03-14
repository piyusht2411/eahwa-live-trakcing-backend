// src/models/Alert.ts
import { Schema, model, Types } from "mongoose";
import { IAlert } from "../types";

const alertSchema = new Schema<IAlert>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "gps_disabled",
        "internet_disabled",
        "device_off",
        "no_movement",
        "suspicious_activity",
        "offline_long",
        "break_exceeded",
        "late_arrival",
        "location_stopped",
        "auto_punch_out",
      ],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Alert = model<IAlert>("Alert", alertSchema);

export default Alert;