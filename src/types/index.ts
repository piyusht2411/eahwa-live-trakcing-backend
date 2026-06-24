// src/types/user.ts
import { Document, Types } from "mongoose";

/**
 * Role hierarchy:
 *   admin        → web app only, no employee features
 *   super_manager → oversees all managers, no employee features
 *   manager      → also treated as an employee (has attendance, leaves, etc.)
 *   hr           → also treated as an employee
 *   employee     → base employee
 *
 * Employee sub-types (applicable to manager / hr / employee roles):
 *   asm    → Area Sales Manager, field-going, location is always tracked
 *   office → Office-based, location is never tracked
 *   both   → Dual role; activeMode determines current behaviour
 *
 * activeMode (only meaningful when employeeType === "both"):
 *   asm    → currently working as ASM → track location
 *   office → currently working as office employee → do not track location
 *   Toggled via a button in the APK (PATCH /users/me/active-mode)
 */
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "admin" | "super_manager" | "manager" | "hr" | "employee";
  /** Sub-type for roles that are treated as employees (manager / hr / employee) */
  employeeType?: "asm" | "office" | "both";
  /**
   * Current active mode.
   * - For employeeType "asm"    → always "asm"    (set on creation, not user-changeable)
   * - For employeeType "office" → always "office" (set on creation, not user-changeable)
   * - For employeeType "both"   → toggled from the APK; drives location-tracking logic
   */
  activeMode?: "asm" | "office";
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
  mapColor?: string;
  travelHistory: { date: Date; distanceKm: number }[];
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
  /** Only for type === "short". 1 or 2 hours. */
  shortLeaveDuration?: 1 | 2;
  date: Date;
  /** End date (inclusive) for multi-day leaves. Null/absent for single-day. */
  endDate?: Date | null;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: Types.ObjectId;
}

export interface IAnomaly extends Document {
  user: Types.ObjectId | IUser;
  type:
  | "repeated_punch"
  | "unrealistic_speed"
  | "excessive_idle";
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
    distance?: number;      // legacy: normalized ratio (0–1) used by scoring
    distanceKm?: number;    // actual kilometers traveled — persistent, written on punch-out
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
  | "offline_long"
  | "late_arrival"
  | "location_stopped";
  description: string;
  timestamp: Date;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotification extends Document {
  user: Types.ObjectId;
  title: string;
  body: string;
  type: "leave_request" | "leave_approved" | "leave_rejected" | "mode_switch" | "general";
  data?: Map<string, string>;
  read: boolean;
  createdAt: Date;
}

export interface IWorkingHours extends Document {
  department: string;
  startTime: string;
  endTime: string;
  breakType: "fixed" | "flexible";
  maxBreakDuration?: number;
}
