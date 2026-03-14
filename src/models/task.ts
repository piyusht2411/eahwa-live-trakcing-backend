// src/models/Task.ts
import { Schema, model, Types } from "mongoose";
import { ITask } from "../types";

const stockItemSchema = new Schema({
  model: { type: String, required: true },
  variation: { type: String },
  quantity: { type: Number, required: true },
  batteryStock: { type: Number, required: true },
});

const taskSchema = new Schema<ITask>(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    showroomName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      fullAddress: { type: String, required: true },
    },
    photos: [
      {
        type: String, // Cloudinary URLs
      },
    ],
    stock: [stockItemSchema],
    feedback: {
      type: String,
    },
    nextOrderPlan: {
      type: String,
    },
    duration: {
      type: Number, // minutes
    },
  },
  { timestamps: true }
);

const Task = model<ITask>("Task", taskSchema);

export default Task;