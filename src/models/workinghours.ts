// src/models/WorkingHours.ts
import { Schema, model } from "mongoose";
import { IWorkingHours } from "../types"; // Define type similarly

const workingHoursSchema = new Schema<IWorkingHours>({
  department: { type: String, required: true },
  startTime: { type: String, required: true }, // e.g., "09:00"
  endTime: { type: String, required: true },
  breakType: { type: String, enum: ["fixed", "flexible"], required: true },
  maxBreakDuration: { type: Number }, // minutes
});

export default model<IWorkingHours>("WorkingHours", workingHoursSchema);

