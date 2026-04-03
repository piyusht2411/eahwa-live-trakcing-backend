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
exports.getTodayLocationHistory = exports.checkHomeIdleUsers = exports.getHeatMap = exports.getLiveTrack = exports.logLocation = void 0;
const locationlogs_1 = __importDefault(require("../models/locationlogs"));
const user_1 = __importDefault(require("../models/user"));
const alert_1 = __importDefault(require("../models/alert"));
const punch_1 = __importDefault(require("../models/punch"));
const anomalyService_1 = require("../services/anomalyService");
const mongoose_1 = require("mongoose");
const socket_1 = require("../socket");
const notificationService_1 = require("../services/notificationService");
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
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
// ─── Dedup Configuration ──────────────────────────────────────────────────────
const DEDUP_WINDOW_MS = 12000; // 12 seconds — prevents foreground + background double-logging
// ─── Haversine ────────────────────────────────────────────────────────────────
const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
/**
 * Google Roads API — Snap to Roads
 * Docs: https://developers.google.com/maps/documentation/roads/snap
 * Pricing: $10 per 1,000 requests (up to 100 points each)
 */
function snapWithGoogle(points) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!GOOGLE_ROADS_API_KEY) {
            console.warn("[Snap] Google Roads API key not set — skipping");
            return { snappedRoute: [], roadDistanceKm: 0 };
        }
        try {
            const CHUNK_SIZE = 100; // Google allows max 100 points per request
            const allSnapped = [];
            for (let i = 0; i < points.length; i += CHUNK_SIZE) {
                const chunk = points.slice(i, i + CHUNK_SIZE);
                const path = chunk.map((p) => `${p.lat},${p.lng}`).join("|");
                const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${GOOGLE_ROADS_API_KEY}`;
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                const res = yield fetch(url, { signal: controller.signal });
                clearTimeout(timeout);
                const data = yield res.json();
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
                distKm += haversineKm(allSnapped[i - 1].lat, allSnapped[i - 1].lng, allSnapped[i].lat, allSnapped[i].lng);
            }
            console.log(`[Snap Google] ${points.length} pts → ${allSnapped.length} snapped, ${distKm.toFixed(2)} km`);
            return {
                snappedRoute: allSnapped,
                roadDistanceKm: Math.round(distKm * 10) / 10,
            };
        }
        catch (err) {
            console.error("[Snap Google] Failed:", (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
            return { snappedRoute: [], roadDistanceKm: 0 };
        }
    });
}
/**
 * OSRM Match API — HMM-based GPS trace snapping
 * Works with self-hosted OSRM or the public demo server.
 * Self-hosted is strongly recommended for production.
 */
function snapWithOSRM(points) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const MAX_PER_REQ = 100;
        try {
            // Deduplicate close points before sending
            const deduped = [points[0]];
            for (let i = 1; i < points.length; i++) {
                const prev = deduped[deduped.length - 1];
                const distM = haversineKm(prev.lat, prev.lng, points[i].lat, points[i].lng) * 1000;
                if (distM >= 8) {
                    deduped.push(points[i]);
                }
            }
            if (deduped.length < 2) {
                return { snappedRoute: [], roadDistanceKm: 0 };
            }
            const allCoords = [];
            let totalDistM = 0;
            // Chunk with 1-point overlap for continuity
            for (let i = 0; i < deduped.length; i += MAX_PER_REQ - 1) {
                const chunk = deduped.slice(i, i + MAX_PER_REQ);
                if (chunk.length < 2)
                    break;
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
                            .map((p) => Math.floor(new Date(p.timestamp).getTime() / 1000).toString())
                            .join(";");
                        url += `&timestamps=${timestamps}`;
                    }
                    const res = yield fetch(url, { signal: controller.signal });
                    clearTimeout(timeout);
                    const data = yield res.json();
                    if (data.code === "Ok" && ((_a = data.matchings) === null || _a === void 0 ? void 0 : _a.length)) {
                        for (const matching of data.matchings) {
                            const pts = matching.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
                            allCoords.push(...(allCoords.length === 0 ? pts : pts.slice(1)));
                            totalDistM += matching.distance || 0;
                        }
                        continue; // Success — move to next chunk
                    }
                }
                catch (_d) { }
                // Fallback: Route API
                clearTimeout(timeout);
                const controller2 = new AbortController();
                const timeout2 = setTimeout(() => controller2.abort(), 10000);
                try {
                    const routeUrl = `${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
                    const res = yield fetch(routeUrl, { signal: controller2.signal });
                    clearTimeout(timeout2);
                    const data = yield res.json();
                    if (data.code === "Ok" && ((_b = data.routes) === null || _b === void 0 ? void 0 : _b.length)) {
                        const route = data.routes[0];
                        const pts = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
                        allCoords.push(...(allCoords.length === 0 ? pts : pts.slice(1)));
                        totalDistM += route.distance || 0;
                    }
                    else {
                        // Complete failure — add raw points
                        allCoords.push(...(allCoords.length === 0
                            ? chunk
                            : chunk.slice(1)));
                    }
                }
                catch (_e) {
                    clearTimeout(timeout2);
                    allCoords.push(...(allCoords.length === 0 ? chunk : chunk.slice(1)));
                }
            }
            // Fallback distance if OSRM returned 0
            if (totalDistM === 0 && allCoords.length >= 2) {
                for (let i = 1; i < allCoords.length; i++) {
                    totalDistM +=
                        haversineKm(allCoords[i - 1].lat, allCoords[i - 1].lng, allCoords[i].lat, allCoords[i].lng) * 1000;
                }
            }
            console.log(`[Snap OSRM] ${points.length} pts → ${allCoords.length} snapped, ${(totalDistM / 1000).toFixed(2)} km`);
            return {
                snappedRoute: allCoords,
                roadDistanceKm: Math.round((totalDistM / 1000) * 10) / 10,
            };
        }
        catch (err) {
            console.error("[Snap OSRM] Failed:", (_c = err === null || err === void 0 ? void 0 : err.message) !== null && _c !== void 0 ? _c : err);
            return { snappedRoute: [], roadDistanceKm: 0 };
        }
    });
}
/** Snap GPS points to roads using the configured provider. */
function snapToRoads(points) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
// ─── Controllers ──────────────────────────────────────────────────────────────
const logLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { location, speed, battery, isOffline, gpsDisabled, internetDisabled, deviceOff, } = req.body;
    const userId = req.user._id;
    try {
        // Only track location for users in ASM mode.
        // Office employees, dual-role users in office mode, and non-employee roles are skipped.
        const user = yield user_1.default.findById(userId).select("activeMode role").lean();
        if (!user || user.activeMode !== "asm") {
            return res.json({ message: "Location tracking not active for this user" });
        }
        // Check punch status
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const latestPunch = yield punch_1.default.findOne({
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
        const recentDuplicate = yield locationlogs_1.default.findOne({
            user: userId,
            timestamp: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
        }).lean();
        if (recentDuplicate) {
            // Return 200 (not 429) — idempotent success, no error to retry
            return res.json({ message: "Location logged" });
        }
        const parsedLocation = typeof location === "string" ? JSON.parse(location) : location;
        // ── Stationary heartbeat dedup ──────────────────────────────────────────
        // When the user sends a heartbeat from the same spot, refresh lastLocationAt
        // (keeps location_stopped alert silent) but skip creating a duplicate log
        // entry (keeps route history clean).
        const lastLog = yield locationlogs_1.default.findOne({ user: userId })
            .sort({ timestamp: -1 })
            .select("location")
            .lean();
        if (lastLog) {
            const distM = haversineKm(lastLog.location.lat, lastLog.location.lng, parsedLocation.lat, parsedLocation.lng) * 1000;
            if (distM < 10) {
                yield user_1.default.findByIdAndUpdate(userId, { lastLocationAt: new Date() });
                return res.json({ message: "Location logged (stationary heartbeat)" });
            }
        }
        // ───────────────────────────────────────────────────────────────────────
        // Reject unrealistic speed
        const MAX_SPEED_MS = 55.56;
        if (speed != null && speed > MAX_SPEED_MS) {
            console.warn(`[Location] Rejected: speed ${speed.toFixed(1)} m/s exceeds limit for user ${userId}`);
            return res.json({ message: "Location rejected: unrealistic speed" });
        }
        const log = new locationlogs_1.default({
            user: userId,
            location: parsedLocation,
            speed,
            battery,
            isOffline,
        });
        yield log.save();
        yield user_1.default.findByIdAndUpdate(userId, { lastLocationAt: new Date() });
        yield (0, anomalyService_1.detectAnomalies)(userId, log);
        // Emit real-time location to watchers
        (0, socket_1.getIO)()
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
            const lastOnlineLog = yield locationlogs_1.default.findOne({
                user: userId,
                isOffline: false,
            })
                .sort({ timestamp: -1 })
                .lean();
            if (lastOnlineLog) {
                const offlineDurationMs = Date.now() - new Date(lastOnlineLog.timestamp).getTime();
                const offlineDurationHours = offlineDurationMs / (1000 * 60 * 60);
                if (offlineDurationHours >= 1) {
                    const durationStr = offlineDurationHours.toFixed(2);
                    const description = `User offline for ${durationStr} hours`;
                    yield alert_1.default.create({
                        user: userId,
                        type: "offline_long",
                        description,
                    });
                    if (process.env.HR_WHATSAPP_TO) {
                        // Fetch name for a friendlier template variable
                        const user = yield user_1.default.findById(userId).lean();
                        yield (0, notificationService_1.sendOfflineAlert)(String(userId), (_a = user === null || user === void 0 ? void 0 : user.name) !== null && _a !== void 0 ? _a : String(userId), // {{1}}
                        durationStr // {{2}}
                        );
                    }
                }
            }
        }
        // ── Device / GPS / Internet alerts ─────────────────────────────────────
        const alertPromises = [];
        const alertDescriptions = [];
        if (gpsDisabled) {
            alertDescriptions.push("GPS disabled on device");
            alertPromises.push(alert_1.default.create({ user: userId, type: "gps_disabled", description: "GPS disabled on device" }));
        }
        if (internetDisabled) {
            alertDescriptions.push("Internet disabled on device");
            alertPromises.push(alert_1.default.create({ user: userId, type: "internet_disabled", description: "Internet disabled on device" }));
        }
        if (deviceOff) {
            alertDescriptions.push("Device switched off");
            alertPromises.push(alert_1.default.create({ user: userId, type: "device_off", description: "Device switched off" }));
        }
        if (alertPromises.length > 0) {
            yield Promise.all(alertPromises);
            if (process.env.HR_WHATSAPP_TO) {
                const user = yield user_1.default.findById(userId).lean();
                yield (0, notificationService_1.sendDeviceAlert)(String(userId), (_b = user === null || user === void 0 ? void 0 : user.name) !== null && _b !== void 0 ? _b : String(userId), // {{1}}
                alertDescriptions // {{2}}
                );
            }
        }
        res.json({ message: "Location logged" });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error" });
    }
});
exports.logLocation = logLocation;
const getLiveTrack = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    try {
        const logs = yield locationlogs_1.default.find({ user: userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate("user", "name");
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ message: "Error" });
    }
});
exports.getLiveTrack = getLiveTrack;
const getHeatMap = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { start, end } = req.query;
    const authUser = req.user;
    const authUserId = authUser._id;
    try {
        const timeQuery = {
            timestamp: {
                $gte: new Date(start),
                $lte: new Date(end),
            },
        };
        if (authUser.role === "super_manager") {
            // super_manager sees all — no user filter added
        }
        else if (authUser.role === "manager") {
            const team = yield user_1.default.find({ managedBy: authUserId }).select("_id");
            timeQuery.user = { $in: team.map((u) => u._id) };
        }
        else if (authUser.role === "employee" || authUser.role === "hr") {
            timeQuery.user = authUserId;
        }
        const logs = yield locationlogs_1.default.aggregate([
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
    }
    catch (error) {
        res.status(500).json({ message: "Error" });
    }
});
exports.getHeatMap = getHeatMap;
// Called by cron job every 30 min between 9 AM – 1 PM
const checkHomeIdleUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const HOME_RADIUS_KM = 0.1;
    const IDLE_MINUTES = 30;
    try {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cutoff = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000);
        // Only check users who are currently in ASM mode (location is being tracked).
        // Office employees and dual-role users in office mode are excluded.
        const asmUserIds = yield user_1.default.find({ activeMode: "asm", isActive: true }).select("_id").lean();
        const asmIdSet = asmUserIds.map((u) => u._id);
        const punchIns = yield punch_1.default.find({
            type: "in",
            date: { $gte: today },
            time: { $lte: cutoff },
            user: { $in: asmIdSet },
        })
            .populate("user", "name homeLocation role activeMode")
            .lean();
        const alerted = [];
        for (const punch of punchIns) {
            const user = punch.user;
            if (!((_a = user === null || user === void 0 ? void 0 : user.homeLocation) === null || _a === void 0 ? void 0 : _a.lat) || !((_b = user === null || user === void 0 ? void 0 : user.homeLocation) === null || _b === void 0 ? void 0 : _b.lng))
                continue;
            const existingAlert = yield alert_1.default.findOne({
                user: user._id,
                type: "no_movement",
                timestamp: { $gte: today },
            }).lean();
            if (existingAlert)
                continue;
            const logs = yield locationlogs_1.default.find({
                user: user._id,
                timestamp: { $gte: new Date(punch.time) },
            }).lean();
            if (logs.length === 0)
                continue;
            const allAtHome = logs.every((log) => haversineKm(user.homeLocation.lat, user.homeLocation.lng, log.location.lat, log.location.lng) <= HOME_RADIUS_KM);
            if (!allAtHome)
                continue;
            const description = `${user.name} punched in ${IDLE_MINUTES}+ min ago but has not moved from home location`;
            yield alert_1.default.create({
                user: user._id,
                type: "no_movement",
                description,
            });
            if (process.env.HR_WHATSAPP_TO) {
                (0, notificationService_1.sendAnomalyAlert)(String(user._id), user.name, "no_movement", description).catch((err) => console.error("Home-idle WhatsApp alert failed:", err.message));
            }
            alerted.push(user.name);
        }
        res.json({ checked: punchIns.length, alerted });
    }
    catch (error) {
        console.error("checkHomeIdleUsers error:", error);
        res.status(500).json({ message: "Error" });
    }
});
exports.checkHomeIdleUsers = checkHomeIdleUsers;
/**
 * GET /api/location/history/:userId
 *
 * Returns today's location logs + server-side road-snapped route.
 * The client no longer needs to do any road matching — it just renders
 * the snappedRoute coords directly on the map.
 */
const getTodayLocationHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    try {
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid userId" });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const logs = yield locationlogs_1.default.find({
            user: userId,
            timestamp: { $gte: today, $lt: tomorrow },
        })
            .select("location timestamp speed battery")
            .sort({ timestamp: 1 })
            .lean();
        // ── Server-side road snapping ──
        // Snap the GPS trace to actual roads using the configured provider.
        // This happens once on the server instead of on every client that views the route.
        let snappedRoute = [];
        let roadDistanceKm = 0;
        if (logs.length >= 2) {
            const points = logs.map((log) => ({
                lat: log.location.lat,
                lng: log.location.lng,
                timestamp: log.timestamp.toISOString(),
            }));
            const result = yield snapToRoads(points);
            snappedRoute = result.snappedRoute;
            roadDistanceKm = result.roadDistanceKm;
        }
        // Calculate haversine distance as fallback
        if (roadDistanceKm === 0 && logs.length >= 2) {
            let km = 0;
            for (let i = 1; i < logs.length; i++) {
                const prev = logs[i - 1].location;
                const curr = logs[i].location;
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
    }
    catch (error) {
        console.error("Today location history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTodayLocationHistory = getTodayLocationHistory;
