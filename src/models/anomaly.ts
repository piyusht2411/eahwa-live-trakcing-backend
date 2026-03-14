// src/models/Anomaly.ts
import { Schema, model, Types } from "mongoose";
import { IAnomaly } from "../types";

const anomalySchema = new Schema<IAnomaly>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "repeated_punch",
        "unrealistic_speed",
        "excessive_idle",
        "short_visit",
        "gps_manipulation",
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
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  { timestamps: true }
);

const Anomaly = model<IAnomaly>("Anomaly", anomalySchema);

export default Anomaly;