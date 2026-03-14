// src/models/Break.ts
import { Schema, model, Types } from "mongoose";
import { IBreak } from "../types";

const breakSchema = new Schema<IBreak>({
  user: { type: Types.ObjectId, ref: "User", required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  type: { type: String, enum: ["start", "end"] },
  duration: { type: Number }, // auto-calc on end
}, { timestamps: true });

export default model<IBreak>("Break", breakSchema);