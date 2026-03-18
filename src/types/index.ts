// src/types/user.ts
import { Document, Types } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "hr" | "manager" | "employee";
  department: string;
  employeeId?: string;
  phone: string;
  profilePicture?: string;
  homeLocation?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  fcmToken?: string | null;
  lastLocationAt?: Date | null;
  manages: Types.ObjectId[];
  managedBy?: Types.ObjectId;
  isActive: boolean;
  joiningDate: Date;
  post?: string;
  aadhaarNumber?: number;
  address?: string;
}

export interface IBreak extends Document {
  user: Types.ObjectId | IUser;
  startLocation: {
    lat: number;
    lng: number;
    address?: string;
  };
  endLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
  startTime: Date;
  endTime?: Date;
  type?: "start" | "end";
  duration?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPunch extends Document {
  user: Types.ObjectId | IUser;
  type: "in" | "out";
  date: Date;
  time: Date;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  selfie?: string | null;
  isAutomatic?: boolean;
  reason?: string | null;
  verified: boolean;
  isLate?: boolean;
}

export interface ILocationLog extends Document {
  user: Types.ObjectId | IUser;
  timestamp: Date;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  speed?: number;
  battery?: number;
  isOffline?: boolean;
}

export interface StockItem {
  model: string;
  variation?: string;
  quantity: number;
  batteryType?: "Lead Acid" | "Lithium-Ion";
  batteryQuantity?: number;
}

export interface ITask extends Document {
  user: Types.ObjectId | IUser;
  date: Date;
  showroomName: string;
  phone: string;
  address: {
    lat: number;
    lng: number;
    fullAddress: string;
  };
  photos: string[];
  stock: StockItem[];
  feedback?: string;
  nextOrderPlan?: string;
  duration?: number;
}

export interface ILeave extends Document {
  user: Types.ObjectId | IUser;
  type: "casual" | "short" | "half-day" | "sick" | "annual";
  date: Date;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: Types.ObjectId;
}

export interface IAnomaly extends Document {
  user: Types.ObjectId | IUser;
  type:
  | "repeated_punch"
  | "unrealistic_speed"
  | "excessive_idle"
  | "short_visit"
  | "gps_manipulation";
  description: string;
  timestamp: Date;
  severity: "low" | "medium" | "high";
}

export interface IHoliday extends Document {
  name: string;
  date: Date;
  description?: string;
}

export interface IPerformance extends Document {
  user: Types.ObjectId | IUser;
  period: "daily" | "weekly" | "monthly";
  periodStart: Date;
  periodEnd: Date;
  score: number;
  metrics: {
    attendance?: number;
    punctuality?: number;
    visitCount?: number;
    productiveRatio?: number;
    distance?: number;
    taskCompletion?: number;
    breakDiscipline?: number;
    stockConsistency?: number;
  };
}

export interface IAlert extends Document {
  user: Types.ObjectId | IUser;
  type:
  | "gps_disabled"
  | "internet_disabled"
  | "device_off"
  | "no_movement"
  | "suspicious_activity"
  | "offline_long"
  | "break_exceeded"
  | "late_arrival"
  | "location_stopped"
  | "auto_punch_out";
  description: string;
  timestamp: Date;
  resolved: boolean;
}

export interface IWorkingHours extends Document {
  department: string;
  startTime: string;
  endTime: string;
  breakType: "fixed" | "flexible";
  maxBreakDuration?: number;
}
