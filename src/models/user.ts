// src/models/User.ts
import { Schema, model, Types } from "mongoose";
import { genSaltSync, hashSync } from "bcrypt";
import { IUser } from "../types";

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "hr", "manager", "employee"],
      default: "employee",
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    homeLocation: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
    },
    fcmToken: {
      type: String,
      default: null,
    },
    lastLocationAt: {
      type: Date,
      default: null,
    },
    travelHistory: [
      {
        date: { type: Date, required: true },
        distanceKm: { type: Number, required: true },
      },
    ],
    manages: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],
    managedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    post: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    aadhaarNumber: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) {
    return next();
  }
  const salt = genSaltSync(10);
  user.password = hashSync(user.password, salt);
  next();
});

const User = model<IUser>("User", userSchema);

export default User;