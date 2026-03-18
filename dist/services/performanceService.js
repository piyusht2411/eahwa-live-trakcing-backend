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
exports.calculateScore = void 0;
// src/services/performanceService.ts
const punch_1 = __importDefault(require("../models/punch"));
const task_1 = __importDefault(require("../models/task"));
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const performance_1 = __importDefault(require("../models/performance"));
const healper_1 = require("../utils/healper");
const calculateScore = (userId, period, start, end) => __awaiter(void 0, void 0, void 0, function* () {
    // Fetch data
    const punches = yield punch_1.default.find({ user: userId, date: { $gte: start, $lte: end } });
    const tasks = yield task_1.default.find({ user: userId, date: { $gte: start, $lte: end } });
    const logs = yield locationlogs_1.default.find({ user: userId, timestamp: { $gte: start, $lte: end } });
    // Simple calculations (expand as needed)
    const attendance = punches.filter(p => p.type === "in").length;
    const visitCount = tasks.length;
    const distance = calculateDistance(logs); // Implement distance calc
    const productiveTime = calculateProductiveTime(logs, tasks); // Implement classification
    const score = Math.min(100, ((attendance * 10) +
        (visitCount * 5) +
        (productiveTime / 8 * 100 * 0.2) + // Assume 8hr day
        (distance / 50 * 100 * 0.1) // Arbitrary
    // Add more metrics
    ));
    const metrics = {
        attendance: attendance,
        visitCount,
        productiveRatio: productiveTime / 8,
        distance,
        // etc.
    };
    // Save or update
    let perf = yield performance_1.default.findOne({ user: userId, period, periodStart: start });
    if (!perf) {
        perf = new performance_1.default({ user: userId, period, periodStart: start, periodEnd: end, score, metrics });
    }
    else {
        perf.score = score;
        perf.metrics = metrics;
    }
    yield perf.save();
    return perf;
});
exports.calculateScore = calculateScore;
const calculateDistance = (logs) => {
    let total = 0;
    for (let i = 1; i < logs.length; i++) {
        total += (0, healper_1.haversineDistance)(logs[i - 1].location.lat, logs[i - 1].location.lng, logs[i].location.lat, logs[i].location.lng);
    }
    return parseFloat(total.toFixed(2));
};
const calculateProductiveTime = (logs, tasks) => {
    // Classify based on tasks (visits), travel between, idle detection
    return 6; // hours
};
