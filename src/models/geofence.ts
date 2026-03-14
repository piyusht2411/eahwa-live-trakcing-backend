import { Schema, model, Types } from "mongoose";

export interface IGeofence {
  name: string;
  department: string; // The department this fence applies to
  center: {
    lat: number;
    lng: number;
  };
  radius: number; // in meters
  isActive: boolean;
  createdBy: Types.ObjectId;
}

const geofenceSchema = new Schema<IGeofence>(
  {
    name: { type: String, required: true },
    department: { type: String, required: true },
    center: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    radius: { type: Number, required: true, default: 500 }, // 500 meters default
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

const Geofence = model<IGeofence>("Geofence", geofenceSchema);

export default Geofence;
