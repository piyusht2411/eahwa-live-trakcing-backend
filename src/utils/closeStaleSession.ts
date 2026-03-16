// src/utils/closeStaleSession.ts
import Break from "../models/break";

export const closeStaleSession = async (userId: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Silently close any open breaks from previous days
  await Break.updateMany(
    {
      user: userId,
      endTime: { $exists: false },
      startTime: { $lt: today },
    },
    {
      $set: {
        endTime: today,
        type: "end",
        duration: 0, // unknown actual duration
      },
    }
  );
};