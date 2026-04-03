import { Schema, model } from "mongoose";
import { INotification } from "../types";

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    body:  { type: String, required: true },
    type: {
      type: String,
      enum: ["leave_request", "leave_approved", "leave_rejected", "mode_switch", "general"],
      required: true,
    },
    // Extra key-value pairs (e.g. leaveId, from, to) used for deep linking / audit
    data: {
      type: Map,
      of: String,
      default: {},
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification = model<INotification>("Notification", notificationSchema);
export default Notification;
