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

// TTL index — configurable via LOCATION_TTL_DAYS env var (default 30 days)
const ttlSeconds = parseInt(process.env.LOCATION_TTL_DAYS ?? "30") * 86400;
locationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ttlSeconds });

// Compound index for fast history queries (user + timestamp)
locationLogSchema.index({ user: 1, timestamp: -1 });

const LocationLog = model<ILocationLog>("LocationLog", locationLogSchema);

export default LocationLog;