// src/models/Punch.ts
import { Schema, model, Types } from "mongoose";
import { IPunch } from "../types";

const punchSchema = new Schema<IPunch>(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["in", "out"], required: true },
    date: { type: Date, required: true },
    time: { type: Date, required: true },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, required: true },
    },
    selfie: { type: String, default: null },
    isAutomatic: { type: Boolean, default: false },
    reason: { type: String, default: null },
    verified: { type: Boolean, default: true },

    // ← NEW STORED FIELD
    isLate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ← Pre-save middleware: compute isLate automatically (in IST)
punchSchema.pre("save", function (next) {
  if (this.type !== "in") {
    this.isLate = false;
    return next();
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(this.time).reduce((acc: any, part) => {
    if (part.type === "hour") acc.hour = parseInt(part.value, 10);
    if (part.type === "minute") acc.minute = parseInt(part.value, 10);
    return acc;
  }, {});

  const hour = parts.hour ?? 0;
  const minute = parts.minute ?? 0;

  this.isLate = (hour > 10) || (hour === 10 && minute > 15);

  next();
});

const Punch = model<IPunch>("Punch", punchSchema);
export default Punch;