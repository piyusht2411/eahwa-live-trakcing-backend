// src/controllers/locationController.ts
import { Request, Response } from "express";
import LocationLog from "../models/locationlogs";
import User from "../models/user";
import Alert from "../models/alert";
import Punch from "../models/punch";
import { detectAnomalies } from "../services/anomalyService";
import { Types } from "mongoose";
import { getIO } from "../socket";

import {
  sendOfflineAlert,
  sendDeviceAlert,
  sendAnomalyAlert,
} from "../services/notificationService";

// ─── Road-Snapping Configuration ──────────────────────────────────────────────
//
// Set these in your .env file:
//
//   SNAP_PROVIDER=google          # "google" | "osrm" | "none"
//   GOOGLE_ROADS_API_KEY=AIza...  # Required if SNAP_PROVIDER=google
//   OSRM_BASE_URL=https://...     # Required if SNAP_PROVIDER=osrm (your self-hosted server)
//                                 # Defaults to public OSRM if not set (not recommended for prod)
//
// Cost estimates for Google Roads API:
//   - $10 per 1,000 requests (each request snaps up to 100 points)
//   - 50 employees × 1 route fetch/day × 30 days = 1,500 requests/month ≈ $15/month
//
// Self-hosted OSRM:
//   - $10–20/month VPS (2GB RAM is enough for India data)
//   - Setup: docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
//   - See: https://github.com/Project-OSRM/osrm-backend/wiki/Running-OSRM

const SNAP_PROVIDER = process.env.SNAP_PROVIDER || "none"; // "google" | "osrm" | "none"
const GOOGLE_ROADS_API_KEY = process.env.GOOGLE_ROADS_API_KEY || "";
const OSRM_BASE_URL =
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

// ─── Dedup Configuration ──────────────────────────────────────────────────────
const DEDUP_WINDOW_MS = 12000; // 12 seconds — prevents foreground + background double-logging

// ─── Haversine ────────────────────────────────────────────────────────────────

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Road-Snapping Functions ──────────────────────────────────────────────────

interface SnappedResult {
  snappedRoute: { lat: number; lng: number }[];
  roadDistanceKm: number;
}

/**
 * Google Roads API — Snap to Roads
 * Docs: https://developers.google.com/maps/documentation/roads/snap
 * Pricing: $10 per 1,000 requests (up to 100 points each)
 */
async function snapWithGoogle(
  points: { lat: number; lng: number }[]
): Promise<SnappedResult> {
  if (!GOOGLE_ROADS_API_KEY) {
    console.warn("[Snap] Google Roads API key not set — skipping");
    return { snappedRoute: [], roadDistanceKm: 0 };
  }

  try {
    const CHUNK_SIZE = 100; // Google allows max 100 points per request
    const allSnapped: { lat: number; lng: number }[] = [];

    for (let i = 0; i < points.length; i += CHUNK_SIZE) {
      const chunk = points.slice(i, i + CHUNK_SIZE);
      const path = chunk.map((p) => `${p.lat},${p.lng}`).join("|");

      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${GOOGLE_ROADS_API_KEY}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      const data = await res.json();

      if (data.error) {
        console.error("[Snap Google] API error:", data.error.message);
        return { snappedRoute: [], roadDistanceKm: 0 };
      }

      if (data.snappedPoints) {
        for (const sp of data.snappedPoints) {
          allSnapped.push({
            lat: sp.location.latitude,
            lng: sp.location.longitude,
          });
        }
      }
    }

    // Calculate road distance from snapped points
    let distKm = 0;
    for (let i = 1; i < allSnapped.length; i++) {
      distKm += haversineKm(
        allSnapped[i - 1].lat,
        allSnapped[i - 1].lng,
        allSnapped[i].lat,
        allSnapped[i].lng
      );
    }

    console.log(
      `[Snap Google] ${points.length} pts → ${allSnapped.length} snapped, ${distKm.toFixed(2)} km`
    );
    return {
      snappedRoute: allSnapped,
      roadDistanceKm: Math.round(distKm * 10) / 10,
    };
  } catch (err: any) {
    console.error("[Snap Google] Failed:", err?.message ?? err);
    return { snappedRoute: [], roadDistanceKm: 0 };
  }
}

/**
 * OSRM Match API — HMM-based GPS trace snapping
 * Works with self-hosted OSRM or the public demo server.
 * Self-hosted is strongly recommended for production.
 */
async function snapWithOSRM(
  points: { lat: number; lng: number; timestamp?: string }[]
): Promise<SnappedResult> {
  const MAX_PER_REQ = 100;

  try {
    // Deduplicate close points before sending
    const deduped: typeof points = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = deduped[deduped.length - 1];
      const distM =
        haversineKm(prev.lat, prev.lng, points[i].lat, points[i].lng) * 1000;
      if (distM >= 8) {
        deduped.push(points[i]);
      }
    }

    if (deduped.length < 2) {
      return { snappedRoute: [], roadDistanceKm: 0 };
    }

    const allCoords: { lat: number; lng: number }[] = [];
    let totalDistM = 0;

    // Chunk with 1-point overlap for continuity
    for (let i = 0; i < deduped.length; i += MAX_PER_REQ - 1) {
      const chunk = deduped.slice(i, i + MAX_PER_REQ);
      if (chunk.length < 2) break;

      const coordStr = chunk
        .map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`)
        .join(";");

      // Try Match API first
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        let url = `${OSRM_BASE_URL}/match/v1/driving/${coordStr}?overview=full&geometries=geojson&tidy=true`;

        // Add timestamps if available (improves matching quality)
        if (chunk[0].timestamp) {
          const timestamps = chunk
            .map((p) =>
              Math.floor(new Date(p.timestamp!).getTime() / 1000).toString()
            )
            .join(";");
          url += `&timestamps=${timestamps}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();

        if (data.code === "Ok" && data.matchings?.length) {
          for (const matching of data.matchings) {
            const pts = (
              matching.geometry.coordinates as [number, number][]
            ).map(([lng, lat]) => ({ lat, lng }));
            allCoords.push(
              ...(allCoords.length === 0 ? pts : pts.slice(1))
            );
            totalDistM += matching.distance || 0;
          }
          continue; // Success — move to next chunk
        }
      } catch { }

      // Fallback: Route API
      clearTimeout(timeout);
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 10000);

      try {
        const routeUrl = `${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
        const res = await fetch(routeUrl, { signal: controller2.signal });
        clearTimeout(timeout2);
        const data = await res.json();

        if (data.code === "Ok" && data.routes?.length) {
          const route = data.routes[0];
          const pts = (
            route.geometry.coordinates as [number, number][]
          ).map(([lng, lat]) => ({ lat, lng }));
          allCoords.push(
            ...(allCoords.length === 0 ? pts : pts.slice(1))
          );
          totalDistM += route.distance || 0;
        } else {
          // Complete failure — add raw points
          allCoords.push(
            ...(allCoords.length === 0
              ? chunk
              : chunk.slice(1))
          );
        }
      } catch {
        clearTimeout(timeout2);
        allCoords.push(
          ...(allCoords.length === 0 ? chunk : chunk.slice(1))
        );
      }
    }

    // Fallback distance if OSRM returned 0
    if (totalDistM === 0 && allCoords.length >= 2) {
      for (let i = 1; i < allCoords.length; i++) {
        totalDistM +=
          haversineKm(
            allCoords[i - 1].lat,
            allCoords[i - 1].lng,
            allCoords[i].lat,
            allCoords[i].lng
          ) * 1000;
      }
    }

    console.log(
      `[Snap OSRM] ${points.length} pts → ${allCoords.length} snapped, ${(totalDistM / 1000).toFixed(2)} km`
    );
    return {
      snappedRoute: allCoords,
      roadDistanceKm: Math.round((totalDistM / 1000) * 10) / 10,
    };
  } catch (err: any) {
    console.error("[Snap OSRM] Failed:", err?.message ?? err);
    return { snappedRoute: [], roadDistanceKm: 0 };
  }
}

/** Snap GPS points to roads using the configured provider. */
async function snapToRoads(
  points: { lat: number; lng: number; timestamp?: string }[]
): Promise<SnappedResult> {
  if (points.length < 2 || SNAP_PROVIDER === "none") {
    return { snappedRoute: [], roadDistanceKm: 0 };
  }

  switch (SNAP_PROVIDER) {
    case "google":
      return snapWithGoogle(points);
    case "osrm":
      return snapWithOSRM(points);
    default:
      return { snappedRoute: [], roadDistanceKm: 0 };
  }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const logLocation = async (req: Request, res: Response) => {
  const {
    location,
    speed,
    battery,
    isOffline,
    gpsDisabled,
    internetDisabled,
    deviceOff,
  } = req.body;
  const userId = (req as any).user._id;

  try {
    // Check punch status
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestPunch = await Punch.findOne({
      user: userId,
      date: { $gte: today },
    })
      .sort({ time: -1 })
      .lean();

    if (!latestPunch || latestPunch.type === "out") {
      return res.json({ message: "Not punched in, location not logged" });
    }

    // ── Server-side deduplication ──
    // This is the SINGLE source of truth for dedup — more reliable than
    // client-side AsyncStorage which has race conditions between foreground
    // and background tasks.
    const recentDuplicate = await LocationLog.findOne({
      user: userId,
      timestamp: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
    }).lean();

    if (recentDuplicate) {
      // Return 200 (not 429) — idempotent success, no error to retry
      return res.json({ message: "Location logged" });
    }

    const parsedLocation =
      typeof location === "string" ? JSON.parse(location) : location;

    // Reject unrealistic speed
    const MAX_SPEED_MS = 55.56;
    if (speed != null && speed > MAX_SPEED_MS) {
      console.warn(
        `[Location] Rejected: speed ${speed.toFixed(1)} m/s exceeds limit for user ${userId}`
      );
      return res.json({ message: "Location rejected: unrealistic speed" });
    }

    const log = new LocationLog({
      user: userId,
      location: parsedLocation,
      speed,
      battery,
      isOffline,
    });

    await log.save();
    await User.findByIdAndUpdate(userId, { lastLocationAt: new Date() });
    await detectAnomalies(userId, log);

    // Emit real-time location to watchers
    getIO()
      .to(`location:${userId}`)
      .emit("location:update", {
        userId,
        location: parsedLocation,
        speed,
        battery,
        isOffline,
        timestamp: log.timestamp,
      });

    // ── Offline duration alert ──────────────────────────────────────────────
    if (isOffline) {
      const lastOnlineLog = await LocationLog.findOne({
        user: userId,
        isOffline: false,
      })
        .sort({ timestamp: -1 })
        .lean();

      if (lastOnlineLog) {
        const offlineDurationMs =
          Date.now() - new Date(lastOnlineLog.timestamp).getTime();
        const offlineDurationHours = offlineDurationMs / (1000 * 60 * 60);

        if (offlineDurationHours >= 1) {
          const durationStr = offlineDurationHours.toFixed(2);
          const description = `User offline for ${durationStr} hours`;

          await Alert.create({
            user: userId,
            type: "offline_long",
            description,
          });

          if (process.env.HR_WHATSAPP_TO) {
            // Fetch name for a friendlier template variable
            const user = await User.findById(userId).lean();
            await sendOfflineAlert(
              String(userId),
              user?.name ?? String(userId), // {{1}}
              durationStr                   // {{2}}
            );
          }
        }
      }
    }

    // ── Device / GPS / Internet alerts ─────────────────────────────────────
    const alertPromises: Promise<unknown>[] = [];
    const alertDescriptions: string[] = [];

    if (gpsDisabled) {
      alertDescriptions.push("GPS disabled on device");
      alertPromises.push(
        Alert.create({ user: userId, type: "gps_disabled", description: "GPS disabled on device" })
      );
    }

    if (internetDisabled) {
      alertDescriptions.push("Internet disabled on device");
      alertPromises.push(
        Alert.create({ user: userId, type: "internet_disabled", description: "Internet disabled on device" })
      );
    }

    if (deviceOff) {
      alertDescriptions.push("Device switched off");
      alertPromises.push(
        Alert.create({ user: userId, type: "device_off", description: "Device switched off" })
      );
    }

    if (alertPromises.length > 0) {
      await Promise.all(alertPromises);

      if (process.env.HR_WHATSAPP_TO) {
        const user = await User.findById(userId).lean();
        await sendDeviceAlert(
          String(userId),
          user?.name ?? String(userId), // {{1}}
          alertDescriptions             // {{2}}
        );
      }
    }

    res.json({ message: "Location logged" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error" });
  }
};

export const getLiveTrack = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;

  try {
    const logs = await LocationLog.find({ user: userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("user", "name");

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

export const getHeatMap = async (req: Request, res: Response) => {
  const { start, end } = req.query;
  const authUser: any = (req as any).user;
  const authUserId = authUser._id;

  try {
    const timeQuery: any = {
      timestamp: {
        $gte: new Date(start as string),
        $lte: new Date(end as string),
      },
    };

    if (authUser.role === "manager") {
      const team = await User.find({ managedBy: authUserId }).select("_id");
      timeQuery.user = { $in: team.map((u: any) => u._id) };
    } else if (authUser.role === "employee") {
      timeQuery.user = authUserId;
    }

    const logs = await LocationLog.aggregate([
      { $match: timeQuery },
      {
        $group: {
          _id: {
            lat: { $round: ["$location.lat", 4] },
            lng: { $round: ["$location.lng", 4] },
          },
          count: { $sum: 1 },
          avgTime: { $avg: "$timestamp" },
        },
      },
    ]);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
};

// Called by cron job every 30 min between 9 AM – 1 PM
export const checkHomeIdleUsers = async (req: Request, res: Response) => {
  const HOME_RADIUS_KM = 0.1;
  const IDLE_MINUTES = 30;

  try {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000);

    const punchIns = await Punch.find({
      type: "in",
      date: { $gte: today },
      time: { $lte: cutoff },
    })
      .populate<{ user: any }>("user", "name homeLocation role")
      .lean();

    const alerted: string[] = [];

    for (const punch of punchIns) {
      const user = punch.user as any;
      if (!user?.homeLocation?.lat || !user?.homeLocation?.lng) continue;

      const existingAlert = await Alert.findOne({
        user: user._id,
        type: "no_movement",
        timestamp: { $gte: today },
      }).lean();
      if (existingAlert) continue;

      const logs = await LocationLog.find({
        user: user._id,
        timestamp: { $gte: new Date(punch.time) },
      }).lean();

      if (logs.length === 0) continue;

      const allAtHome = logs.every(
        (log: any) =>
          haversineKm(
            user.homeLocation.lat,
            user.homeLocation.lng,
            log.location.lat,
            log.location.lng
          ) <= HOME_RADIUS_KM
      );

      if (!allAtHome) continue;

      const description = `${user.name} punched in ${IDLE_MINUTES}+ min ago but has not moved from home location`;
      await Alert.create({
        user: user._id,
        type: "no_movement",
        description,
      });

      if (process.env.HR_WHATSAPP_TO) {
        sendAnomalyAlert(
          String(user._id),
          user.name,
          "no_movement",
          description
        ).catch((err) =>
          console.error("Home-idle WhatsApp alert failed:", err.message)
        );
      }

      alerted.push(user.name);
    }

    res.json({ checked: punchIns.length, alerted });
  } catch (error) {
    console.error("checkHomeIdleUsers error:", error);
    res.status(500).json({ message: "Error" });
  }
};

/**
 * GET /api/location/history/:userId
 *
 * Returns today's location logs + server-side road-snapped route.
 * The client no longer needs to do any road matching — it just renders
 * the snappedRoute coords directly on the map.
 */
export const getTodayLocationHistory = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    if (!Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid userId" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const logs = await LocationLog.find({
      user: userId,
      timestamp: { $gte: today, $lt: tomorrow },
    })
      .select("location timestamp speed battery")
      .sort({ timestamp: 1 })
      .lean();

    // ── Server-side road snapping ──
    // Snap the GPS trace to actual roads using the configured provider.
    // This happens once on the server instead of on every client that views the route.
    let snappedRoute: { lat: number; lng: number }[] = [];
    let roadDistanceKm = 0;

    if (logs.length >= 2) {
      const points = logs.map((log: any) => ({
        lat: log.location.lat,
        lng: log.location.lng,
        timestamp: log.timestamp.toISOString(),
      }));

      const result = await snapToRoads(points);
      snappedRoute = result.snappedRoute;
      roadDistanceKm = result.roadDistanceKm;
    }

    // Calculate haversine distance as fallback
    if (roadDistanceKm === 0 && logs.length >= 2) {
      let km = 0;
      for (let i = 1; i < logs.length; i++) {
        const prev = (logs[i - 1] as any).location;
        const curr = (logs[i] as any).location;
        km += haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
      }
      roadDistanceKm = Math.round(km * 10) / 10;
    }

    res.status(200).json({
      success: true,
      data: logs,
      snappedRoute,
      roadDistanceKm,
      totalPoints: logs.length,
      date: today.toISOString().split("T")[0],
      snapProvider: SNAP_PROVIDER,
    });
  } catch (error) {
    console.error("Today location history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};