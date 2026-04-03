"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const bcrypt_1 = require("bcrypt");
const userSchema = new mongoose_1.Schema({
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
        enum: ["admin", "super_manager", "manager", "hr", "employee"],
        default: "employee",
        required: true,
    },
    /**
     * Sub-type for roles treated as employees (manager / hr / employee).
     * Not required for admin / super_manager.
     */
    employeeType: {
        type: String,
        enum: ["asm", "office", "both"],
        default: null,
    },
    /**
     * Current active mode — drives location-tracking logic.
     * Fixed for single-type employees; toggled via APK for "both" type.
     */
    activeMode: {
        type: String,
        enum: ["asm", "office"],
        default: null,
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
    mapColor: {
        type: String,
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
            type: mongoose_1.Types.ObjectId,
            ref: "User",
        },
    ],
    managedBy: {
        type: mongoose_1.Types.ObjectId,
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
}, { timestamps: true });
/**
 * Virtual: true when location tracking should be active for this user.
 * - admin / super_manager   → never tracked
 * - asm employeeType        → always tracked
 * - office employeeType     → never tracked
 * - both employeeType       → tracked only when activeMode === "asm"
 */
userSchema.virtual("shouldTrackLocation").get(function () {
    if (this.role === "admin" || this.role === "super_manager")
        return false;
    return this.activeMode === "asm";
});
/**
 * Keep activeMode consistent with employeeType.
 *
 * Auto-assignment rules (applied before the activeMode sync):
 *   - manager / super_manager / hr with no employeeType set → "both" (they can work in the field or office)
 *   - admin with no employeeType → remains null (no tracking)
 *
 * ActiveMode sync:
 *   - "asm"    → lock activeMode to "asm"
 *   - "office" → lock activeMode to "office"
 *   - "both"   → default activeMode to "office" if unset (they start in office mode)
 *   - null     → clear activeMode (admin only)
 */
userSchema.pre("save", function (next) {
    const dualRoles = ["manager", "super_manager", "hr"];
    // Auto-assign "both" for managerial/HR roles that haven't been given an explicit employeeType
    if ((this.isNew || this.isModified("role")) && !this.employeeType && dualRoles.includes(this.role)) {
        this.employeeType = "both";
    }
    if (this.isModified("employeeType") || this.isNew) {
        if (this.employeeType === "asm") {
            this.activeMode = "asm";
        }
        else if (this.employeeType === "office") {
            this.activeMode = "office";
        }
        else if (this.employeeType === "both" && !this.activeMode) {
            this.activeMode = "office"; // default to office mode
        }
        else if (!this.employeeType) {
            this.activeMode = undefined;
        }
    }
    next();
});
userSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = this;
        if (!user.isModified("password")) {
            return next();
        }
        const salt = (0, bcrypt_1.genSaltSync)(10);
        user.password = (0, bcrypt_1.hashSync)(user.password, salt);
        next();
    });
});
const User = (0, mongoose_1.model)("User", userSchema);
exports.default = User;
