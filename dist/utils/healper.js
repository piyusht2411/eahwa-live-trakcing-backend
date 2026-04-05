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
exports.getRoadSegmentDistances = exports.getRoadDistance = exports.calculateSpeed = exports.haversineDistance = void 0;
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
exports.haversineDistance = haversineDistance;
const calculateSpeed = (log1, log2) => {
    const dist = (0, exports.haversineDistance)(log1.location.lat, log1.location.lng, log2.location.lat, log2.location.lng);
    const timeDiff = (log1.timestamp.getTime() - log2.timestamp.getTime()) / (1000 * 60 * 60); // hours
    return timeDiff > 0 ? dist / timeDiff : 0; // km/h
};
exports.calculateSpeed = calculateSpeed;
const SNAP_PROVIDER = process.env.SNAP_PROVIDER || "none"; // "google" | "osrm" | "none"
const GOOGLE_ROADS_API_KEY = process.env.GOOGLE_ROADS_API_KEY || "";
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const OSRM_CHUNK_SIZE = 100; // max waypoints per OSRM request
/**
 * Get road-based total distance (km) using the configured snap provider.
 * Uses Google Roads API when SNAP_PROVIDER=google, OSRM when SNAP_PROVIDER=osrm,
 * and haversine fallback otherwise.
 */
const getRoadDistance = (coords) => __awaiter(void 0, void 0, void 0, function* () {
    if (coords.length < 2)
        return 0;
    if (SNAP_PROVIDER === "google" && GOOGLE_ROADS_API_KEY) {
        const km = yield _googleRoadDistance(coords);
        if (km > 0)
            return parseFloat(km.toFixed(2));
    }
    if (SNAP_PROVIDER === "osrm" || SNAP_PROVIDER === "none") {
        // Try OSRM match only — no Route API fallback (Route API over-counts GPS traces)
        let totalKm = 0;
        let osrmOk = true;
        for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
            const chunk = coords.slice(i, i + OSRM_CHUNK_SIZE);
            if (chunk.length < 2)
                break;
            const km = yield _osrmMatchDistance(chunk);
            if (km === 0) {
                osrmOk = false;
                break;
            }
            totalKm += km;
        }
        if (osrmOk && totalKm > 0)
            return parseFloat(totalKm.toFixed(2));
    }
    // Fallback: haversine straight-line sum (always accurate for short distances)
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
        total += (0, exports.haversineDistance)(coords[i - 1].lat, coords[i - 1].lng, coords[i].lat, coords[i].lng);
    }
    return parseFloat(total.toFixed(2));
});
exports.getRoadDistance = getRoadDistance;
/**
 * Google Roads API — Snap to Roads, then sum haversine over snapped points.
 * Returns 0 on failure so caller can fall through to next provider.
 */
function _googleRoadDistance(coords) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!GOOGLE_ROADS_API_KEY)
            return 0;
        try {
            const CHUNK_SIZE = 100;
            const allSnapped = [];
            for (let i = 0; i < coords.length - 1; i += CHUNK_SIZE - 1) {
                const chunk = coords.slice(i, i + CHUNK_SIZE);
                const path = chunk.map(p => `${p.lat},${p.lng}`).join("|");
                const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=false&key=${GOOGLE_ROADS_API_KEY}`;
                const res = yield fetch(url, { signal: AbortSignal.timeout(15000) });
                const data = yield res.json();
                if (data.error) {
                    console.error("[Snap Google] API error:", data.error.message);
                    return 0;
                }
                if (data.snappedPoints) {
                    for (const sp of data.snappedPoints) {
                        allSnapped.push({ lat: sp.location.latitude, lng: sp.location.longitude });
                    }
                }
            }
            let distKm = 0;
            for (let i = 1; i < allSnapped.length; i++) {
                distKm += (0, exports.haversineDistance)(allSnapped[i - 1].lat, allSnapped[i - 1].lng, allSnapped[i].lat, allSnapped[i].lng);
            }
            console.log(`[Stats Google] ${coords.length} pts → ${allSnapped.length} snapped, ${distKm.toFixed(2)} km`);
            return Math.round(distKm * 10) / 10;
        }
        catch (err) {
            console.error("[Stats Google] Failed:", (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
            return 0;
        }
    });
}
/**
 * Get road-based distance per segment (km) using the configured snap provider.
 * Returns an array of length coords.length - 1 where result[i] = road distance from coords[i] to coords[i+1].
 * Uses Google Roads API when SNAP_PROVIDER=google, OSRM when osrm, haversine as fallback.
 */
const getRoadSegmentDistances = (coords) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (coords.length < 2)
        return [];
    // Google Roads: snap all points using originalIndex to map distances back to original segments
    if (SNAP_PROVIDER === "google" && GOOGLE_ROADS_API_KEY) {
        try {
            const CHUNK_SIZE = 100;
            // Each entry: snapped lat/lng + which original index it belongs to
            const allSnapped = [];
            let chunkOffset = 0;
            for (let i = 0; i < coords.length; i += CHUNK_SIZE) {
                const chunk = coords.slice(i, i + CHUNK_SIZE);
                const path = chunk.map(p => `${p.lat},${p.lng}`).join("|");
                const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${GOOGLE_ROADS_API_KEY}`;
                const res = yield fetch(url, { signal: AbortSignal.timeout(15000) });
                const data = yield res.json();
                if (data.error)
                    throw new Error(data.error.message);
                if (data.snappedPoints) {
                    for (const sp of data.snappedPoints) {
                        allSnapped.push({
                            lat: sp.location.latitude,
                            lng: sp.location.longitude,
                            // originalIndex is relative to the chunk — offset to global index
                            originalIndex: ((_a = sp.originalIndex) !== null && _a !== void 0 ? _a : 0) + chunkOffset,
                        });
                    }
                }
                chunkOffset += chunk.length;
            }
            if (allSnapped.length >= 2) {
                // Sum haversine distances of snapped sub-points that fall between each pair of original points
                const segmentDistances = new Array(coords.length - 1).fill(0);
                for (let i = 1; i < allSnapped.length; i++) {
                    const prev = allSnapped[i - 1];
                    const curr = allSnapped[i];
                    const segIdx = Math.min(prev.originalIndex, coords.length - 2);
                    segmentDistances[segIdx] += (0, exports.haversineDistance)(prev.lat, prev.lng, curr.lat, curr.lng);
                }
                return segmentDistances.map(d => parseFloat(d.toFixed(3)));
            }
        }
        catch (err) {
            console.error("[SegDist Google] Failed:", (_b = err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : err);
        }
    }
    // OSRM fallback
    if (SNAP_PROVIDER === "osrm" || SNAP_PROVIDER === "none") {
        const allSegments = [];
        for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
            const chunk = coords.slice(i, i + OSRM_CHUNK_SIZE);
            if (chunk.length < 2)
                break;
            const segments = yield _osrmMatchSegments(chunk);
            allSegments.push(...segments);
        }
        if (allSegments.length === coords.length - 1)
            return allSegments;
    }
    // Haversine fallback
    return coords.slice(1).map((c, i) => parseFloat((0, exports.haversineDistance)(coords[i].lat, coords[i].lng, c.lat, c.lng).toFixed(3)));
});
exports.getRoadSegmentDistances = getRoadSegmentDistances;
/**
 * Use OSRM Map Matching (/match/v1/driving/) to get total distance for a GPS trace chunk.
 * Falls back to Route API (always succeeds with 2+ points), then haversine as last resort.
 */
function _osrmMatchDistance(chunk) {
    return __awaiter(this, void 0, void 0, function* () {
        const coordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
        // Build timestamps parameter if available
        const hasTimestamps = chunk.every(c => c.timestamp != null);
        let queryParams = "overview=false&geometries=polyline";
        if (hasTimestamps) {
            const timestamps = chunk.map(c => Math.floor(new Date(c.timestamp).getTime() / 1000)).join(";");
            queryParams += `&timestamps=${timestamps}`;
        }
        // Use generous radius (20m) so GPS inaccuracy doesn't cause points to be dropped
        const radiuses = chunk.map(() => "20").join(";");
        queryParams += `&radiuses=${radiuses}`;
        try {
            const res = yield fetch(`${OSRM_BASE_URL}/match/v1/driving/${coordStr}?${queryParams}`, {
                signal: AbortSignal.timeout(8000),
            });
            const data = yield res.json();
            if (data.code === "Ok" && data.matchings && data.matchings.length > 0) {
                // Sum distances across all matched sub-traces (OSRM may split the trace)
                let totalMeters = 0;
                for (const matching of data.matchings) {
                    totalMeters += matching.distance;
                }
                return totalMeters / 1000;
            }
        }
        catch (_) {
            // fall through to Route API fallback
        }
        // Return 0 so getRoadDistance can fall back to haversine — do NOT use Route API
        // (Route API over-counts GPS traces by routing between each point as a stop)
        return 0;
    });
}
/**
 * Use OSRM Map Matching to get per-segment distances for a GPS trace chunk.
 * Falls back to Route API (always succeeds with 2+ points), then haversine as last resort.
 * Returns an array of distances (km) for each consecutive pair.
 */
function _osrmMatchSegments(chunk) {
    return __awaiter(this, void 0, void 0, function* () {
        const coordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
        // Build timestamps parameter if available
        const hasTimestamps = chunk.every(c => c.timestamp != null);
        let queryParams = "overview=false&geometries=polyline";
        if (hasTimestamps) {
            const timestamps = chunk.map(c => Math.floor(new Date(c.timestamp).getTime() / 1000)).join(";");
            queryParams += `&timestamps=${timestamps}`;
        }
        const radiuses = chunk.map(() => "20").join(";");
        queryParams += `&radiuses=${radiuses}`;
        try {
            const res = yield fetch(`${OSRM_BASE_URL}/match/v1/driving/${coordStr}?${queryParams}`, {
                signal: AbortSignal.timeout(8000),
            });
            const data = yield res.json();
            if (data.code === "Ok" && data.matchings && data.matchings.length > 0) {
                // Collect per-leg distances across all matched sub-traces
                const segmentDistances = [];
                for (const matching of data.matchings) {
                    for (const leg of matching.legs) {
                        segmentDistances.push(leg.distance / 1000);
                    }
                }
                // OSRM may drop outlier points, so the number of legs may not match chunk.length - 1.
                // If it matches, return directly; otherwise fall through to Route API fallback.
                if (segmentDistances.length === chunk.length - 1) {
                    return segmentDistances;
                }
            }
        }
        catch (_) {
            // fall through to Route API fallback
        }
        // Fallback 1: Route API with steps — gives per-leg breakdown for any 2+ waypoints
        try {
            const routeCoordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
            const routeRes = yield fetch(`${OSRM_BASE_URL}/route/v1/driving/${routeCoordStr}?overview=false&steps=false`, { signal: AbortSignal.timeout(8000) });
            const routeData = yield routeRes.json();
            if (routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0) {
                const legs = routeData.routes[0].legs;
                if (legs.length === chunk.length - 1) {
                    return legs.map((leg) => leg.distance / 1000);
                }
                // Leg count mismatch — distribute total distance evenly as best estimate
                const totalKm = routeData.routes[0].distance / 1000;
                const perSegment = totalKm / (chunk.length - 1);
                return Array(chunk.length - 1).fill(perSegment);
            }
        }
        catch (_) {
            // fall through to haversine fallback
        }
        // Fallback 2: straight-line haversine per segment (last resort)
        return chunk.slice(1).map((c, i) => (0, exports.haversineDistance)(chunk[i].lat, chunk[i].lng, c.lat, c.lng));
    });
}
