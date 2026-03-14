// src/models/Holiday.ts
import { Schema, model } from "mongoose";
import { IHoliday } from "../types";

const holidaySchema = new Schema<IHoliday>(
  {
    name: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

const Holiday = model<IHoliday>("Holiday", holidaySchema);

export default Holiday;