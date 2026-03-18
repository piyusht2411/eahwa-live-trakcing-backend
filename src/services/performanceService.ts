// src/services/performanceService.ts
import Punch from "../models/punch";
import Task from "../models/task";
import LocationLog from "../models/locationlogs";
import Performance from "../models/performance";
import { IPerformance } from "../types";
import { haversineDistance } from "../utils/healper";

export const calculateScore = async (userId: string, period: "daily" | "weekly" | "monthly", start: Date, end: Date): Promise<IPerformance> => {
  // Fetch data
  const punches = await Punch.find({ user: userId, date: { $gte: start, $lte: end } });
  const tasks = await Task.find({ user: userId, date: { $gte: start, $lte: end } });
  const logs = await LocationLog.find({ user: userId, timestamp: { $gte: start, $lte: end } });

  // Simple calculations (expand as needed)
  const attendance = punches.filter(p => p.type === "in").length;
  const visitCount = tasks.length;
  const distance = calculateDistance(logs); // Implement distance calc
  const productiveTime = calculateProductiveTime(logs, tasks); // Implement classification

  const score = Math.min(100, (
    (attendance * 10) +
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
  let perf = await Performance.findOne({ user: userId, period, periodStart: start });
  if (!perf) {
    perf = new Performance({ user: userId, period, periodStart: start, periodEnd: end, score, metrics });
  } else {
    perf.score = score;
    perf.metrics = metrics;
  }
  await perf.save();

  return perf;
};

const calculateDistance = (logs: any[]) => {
  let total = 0;
  for (let i = 1; i < logs.length; i++) {
    total += haversineDistance(
      logs[i - 1].location.lat, logs[i - 1].location.lng,
      logs[i].location.lat, logs[i].location.lng
    );
  }
  return parseFloat(total.toFixed(2));
};

const calculateProductiveTime = (logs: any[], tasks: any[]) => {
  // Classify based on tasks (visits), travel between, idle detection
  return 6; // hours
};