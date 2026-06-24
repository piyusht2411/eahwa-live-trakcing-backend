// src/models/Leave.ts
import { Schema, model, Types } from "mongoose";
import { ILeave } from "../types";

const leaveSchema = new Schema<ILeave>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["casual", "short", "half-day", "sick", "annual"],
      required: true,
    },
    // Only for type === "short". Stores how many hours (1 or 2) the employee requested.
    shortLeaveDuration: {
      type: Number,
      enum: [1, 2],
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    // End date for multi-day leaves (inclusive). For single-day leaves this is
    // null and the leave spans only `date`. Only used by full-day leave types
    // (casual / sick / annual) — never for "short" or "half-day".
    endDate: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Leave = model<ILeave>("Leave", leaveSchema);

export default Leave;