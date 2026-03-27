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
// src/models/User.ts
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
