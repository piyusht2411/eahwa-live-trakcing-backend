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
    date: {
      type: Date,
      required: true,
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