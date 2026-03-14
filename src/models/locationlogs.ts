// src/models/LocationLog.ts
import { Schema, model, Types } from "mongoose";
import { ILocationLog } from "../types";

const locationLogSchema = new Schema<ILocationLog>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },
    speed: {
      type: Number, // km/h
    },
    battery: {
      type: Number, // %
    },
    isOffline: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// TTL index to delete after 1 day (86400 seconds)
locationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const LocationLog = model<ILocationLog>("LocationLog", locationLogSchema);

export default LocationLog;