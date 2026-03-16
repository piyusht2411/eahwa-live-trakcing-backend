// src/utils/punchCheck.ts
import Punch from "../models/punch";

export const isUserPunchedIn = async (userId: string): Promise<boolean> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const lastPunch = await Punch.findOne({
    user: userId,
    date: { $gte: today, $lt: tomorrow },
  }).sort({ time: -1 });

  if (!lastPunch) return false;
  return lastPunch.type === "in";
};