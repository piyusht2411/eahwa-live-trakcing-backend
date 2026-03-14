// src/models/Punch.ts
import { Schema, model, Types } from "mongoose";
import { IPunch } from "../types";

const punchSchema = new Schema<IPunch>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: Date,
      required: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    selfie: {
      type: String, // Cloudinary URL
      default: null,
    },
    isAutomatic: {
      type: Boolean,
      default: false,
    },
    reason: {
      type: String,
      default: null,
    },
    verified: {
      type: Boolean,
      default: true, // Auto-verified, admin can override
    },
  },
  { timestamps: true }
);

const Punch = model<IPunch>("Punch", punchSchema);

export default Punch;