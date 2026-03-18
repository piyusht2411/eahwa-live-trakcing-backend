// src/models/Break.ts
import { Schema, model, Types } from "mongoose";
import { IBreak } from "../types";

const breakSchema = new Schema<IBreak>({
  user: { type: Types.ObjectId, ref: "User", required: true },

  // ← NEW: Location where break started
  startLocation: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
  },

  // ← NEW: Location where break ended (null until break ends)
  endLocation: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
  },

  startTime: { type: Date, required: true },
  endTime: { type: Date },
  type: { type: String, enum: ["start", "end"] },
  duration: { type: Number }, // auto-calculated on end
}, { timestamps: true });

export default model<IBreak>("Break", breakSchema);