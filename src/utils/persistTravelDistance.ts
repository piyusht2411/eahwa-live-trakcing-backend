// src/utils/persistTravelDistance.ts
// Computes a user's road-travel distance for the current day from their location
// logs and persists it to BOTH long-lived stores: User.travelHistory and the
// daily Performance document. Shared by manual punch-out and the automatic
// (inactivity + end-of-day) punch-out paths so auto-closed days still get a
// distance total.
import LocationLog from "../models/locationlogs";
import User from "../models/user";
import Performance from "../models/performance";
import { getRoadDistance } from "./healper";

export const persistDailyTravelDistance = async (userId: string): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const locationLogs = await LocationLog.find({
    user: userId,
    timestamp: { $gte: today, $lte: endOfDay },
  })
    .sort({ timestamp: 1 })
    .select("location timestamp")
    .lean();

  const coords = locationLogs.map((l: any) => ({
    lat: l.location.lat,
    lng: l.location.lng,
    timestamp: l.timestamp,
  }));

  // getRoadDistance returns 0 for fewer than 2 points, so this is safe even when
  // the user sent little or no location data.
  const distanceKm = await getRoadDistance(coords);

  // ── Persist in User.travelHistory (primary long-lived store) ──
  await User.findOneAndUpdate(
    { _id: userId, "travelHistory.date": today },
    { $set: { "travelHistory.$.distanceKm": distanceKm } }
  ).then(async (updated) => {
    if (!updated) {
      await User.findByIdAndUpdate(userId, {
        $push: { travelHistory: { date: today, distanceKm } },
      });
    }
  });

  // ── Also persist in Performance (daily) so reports never lose distance ──
  const perfEndOfDay = new Date(today);
  perfEndOfDay.setHours(23, 59, 59, 999);
  await Performance.findOneAndUpdate(
    { user: userId, period: "daily", periodStart: today },
    {
      $set: { "metrics.distanceKm": distanceKm },
      // $setOnInsert only runs when MongoDB creates a NEW document (upsert).
      $setOnInsert: { periodEnd: perfEndOfDay, score: 0 },
    },
    { upsert: true }
  );

  return distanceKm;
};
