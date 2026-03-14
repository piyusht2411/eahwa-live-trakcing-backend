// src/models/Performance.ts
import { Schema, model, Types } from "mongoose";
import { IPerformance } from "../types";

const performanceSchema = new Schema<IPerformance>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    period: {
      type: String, // "daily", "weekly", "monthly"
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    score: {
      type: Number, // 0-100
      required: true,
    },
    metrics: {
      attendance: { type: Number },
      punctuality: { type: Number },
      visitCount: { type: Number },
      productiveRatio: { type: Number },
      distance: { type: Number },
      taskCompletion: { type: Number },
      breakDiscipline: { type: Number },
      stockConsistency: { type: Number },
    },
  },
  { timestamps: true }
);

const Performance = model<IPerformance>("Performance", performanceSchema);

export default Performance;