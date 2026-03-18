// src/models/Task.ts
import { Schema, model, Types } from "mongoose";
import { ITask } from "../types";

const scooterStockSchema = new Schema({
  model: {
    type: String,
    required: true,
    enum: [
      "Dangus Pro",
      "Dangus Plus",
      "Glide Plus",
      "Nebo Plus",
      "Nebo",
      "Nebo Advance",
      "Nebo XL",
      "Nebo Super",
      "Rakkit 100",
      "2-Wheeler Loader",
      "3-Wheeler Loaded",
      "Dangus Pro Handicap",
    ],
  },
  variation: { type: String },
  quantity: { type: Number, required: true, min: 0 },
});

const batteryStockSchema = new Schema({
  batteryType: {
    type: String,
    required: true,
    enum: ["Lead Acid", "Lithium-Ion"],
  },
  batteryQuantity: { type: Number, required: true, min: 0 },
});

// Base schema for polymorphic array (this is where the magic happens)
const stockBaseSchema = new Schema(
  {},
  { 
    _id: false, 
    discriminatorKey: "kind"   // ← tells Mongoose which schema to use
  }
);

// Apply the two schemas you already wrote
stockBaseSchema.discriminator("scooter", scooterStockSchema);
stockBaseSchema.discriminator("battery", batteryStockSchema);

const taskSchema = new Schema<ITask>(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    showroomName: { type: String, required: true },
    phone: { type: String, required: true },
    address: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      fullAddress: { type: String, required: true },
    },
    photos: [{ type: String }],
    stock: [stockBaseSchema],   // ← now uses your two schemas!
    feedback: { type: String },
    nextOrderPlan: { type: String },
    duration: { type: Number },
  },
  { timestamps: true }
);

// ✅ No need for the old pre-save hook anymore — discriminators + required fields handle everything
// (Mongoose will automatically validate scooter items against scooterStockSchema and battery items against batteryStockSchema)

const Task = model<ITask>("Task", taskSchema);
export default Task;