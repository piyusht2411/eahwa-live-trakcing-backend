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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const bcrypt_1 = require("bcrypt");
const targetAchievedHistory_1 = __importDefault(require("./targetAchievedHistory"));
const ratingHistory_1 = __importDefault(require("./ratingHistory"));
const userTargetAchieved_1 = __importDefault(require("./userTargetAchieved"));
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
    post: {
        type: String,
        default: "",
    },
    passwordResetToken: {
        type: String,
        default: "",
    },
    tokenExpire: {
        type: Date,
        default: null,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    address: {
        type: String,
        default: "",
    },
    aadhaarNumber: {
        type: Number,
        default: null,
    },
    role: {
        type: String,
        enum: ["admin", "employee", "hr", "manager", "admin-plant", "guard"],
        default: "employee",
        required: true,
    },
    employeeId: {
        type: String,
        default: "",
    },
    phone: {
        type: Number,
        default: null,
    },
    joiningDate: {
        type: String,
        default: "",
    },
    lastWorkingDate: {
        type: Date,
    },
    targetAchieved: {
        battery: {
            current: {
                type: userTargetAchieved_1.default,
                default: () => ({}),
            },
            history: [targetAchievedHistory_1.default],
        },
        eRickshaw: {
            current: {
                type: userTargetAchieved_1.default,
                default: () => ({}),
            },
            history: [targetAchievedHistory_1.default],
        },
        scooty: {
            current: {
                type: userTargetAchieved_1.default,
                default: () => ({}),
            },
            history: [targetAchievedHistory_1.default],
        },
    },
    profilePicture: {
        type: String,
        default: "",
    },
    visitors: [
        {
            type: mongoose_1.Types.ObjectId,
            ref: "Visitor",
        },
    ],
    dailyLeads: [
        {
            type: mongoose_1.Types.ObjectId,
            ref: "DailyLead",
        },
    ],
    leads: [
        {
            type: mongoose_1.Types.ObjectId,
            ref: "Lead",
        },
    ],
    targetLeads: [{ type: mongoose_1.Types.ObjectId, ref: "Lead" }],
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
    orders: [
        {
            type: mongoose_1.Types.ObjectId,
            ref: "Order",
        },
    ],
    ratings: {
        current: {
            type: Number,
            default: 0,
        },
        history: [ratingHistory_1.default],
    },
    fcmToken: {
        type: String,
        default: null,
        sparse: true,
    },
});
userSchema.pre("save", function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = this;
        if (!user.isModified("password") && !user.isModified("passwordResetToken")) {
            return next();
        }
        const salt = (0, bcrypt_1.genSaltSync)(10);
        if (user.isModified("password")) {
            user.password = (0, bcrypt_1.hashSync)(user.password, salt);
        }
        if (user.isModified("passwordResetToken")) {
            user.passwordResetToken = (0, bcrypt_1.hashSync)(user.passwordResetToken, salt);
        }
        next();
    });
});
userSchema.pre("save", function (next) {
    const user = this;
    if (user.isModified("ratings.history")) {
        const ratings = user.ratings.history
            .flatMap((entry) => [entry.managerRating, entry.adminRating])
            .filter((rating) => typeof rating === "number");
        user.ratings.current =
            ratings.length > 0
                ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
                : 0;
    }
    next();
});
const User = (0, mongoose_1.model)("User", userSchema);
exports.default = User;
