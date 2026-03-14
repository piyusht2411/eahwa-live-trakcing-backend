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
exports.getPerformances = void 0;
const performance_1 = __importDefault(require("../models/performance"));
const getPerformances = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { period = "daily" } = req.query; // daily, weekly, monthly
        let startDate = new Date();
        if (period === "daily") {
            startDate.setHours(0, 0, 0, 0);
        }
        else if (period === "weekly") {
            const day = startDate.getDay();
            const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            startDate = new Date(startDate.setDate(diff));
            startDate.setHours(0, 0, 0, 0);
        }
        else if (period === "monthly") {
            startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        }
        const performances = yield performance_1.default.find({
            period,
            periodStart: { $gte: startDate }
        })
            .populate("user", "name employeeId department profilePicture")
            .sort({ score: -1, createdAt: -1 })
            .lean();
        res.status(200).json({
            success: true,
            data: performances
        });
    }
    catch (error) {
        console.error("Get performances error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getPerformances = getPerformances;
