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
const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_CHUNK_SIZE = 100; // max waypoints per OSRM request
/**
 * Get road-based total distance (km) using OSRM Map Matching API.
 * Map matching snaps GPS traces to the actual road the user traveled,
 * unlike routing which invents its own optimal path.
 * Falls back to haversine sum if OSRM is unavailable.
 */
const getRoadDistance = (coords) => __awaiter(void 0, void 0, void 0, function* () {
    if (coords.length < 2)
        return 0;
    let totalKm = 0;
    // Process in overlapping chunks so chunk boundaries share an endpoint
    for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
        const chunk = coords.slice(i, i + OSRM_CHUNK_SIZE);
        if (chunk.length < 2)
            break;
        totalKm += yield _osrmMatchDistance(chunk);
    }
    return parseFloat(totalKm.toFixed(2));
});
exports.getRoadDistance = getRoadDistance;
/**
 * Get road-based distance per segment (km) using OSRM Map Matching API.
 * Returns an array of length coords.length - 1 where result[i] = road distance from coords[i] to coords[i+1].
 * Falls back to haversine per segment if OSRM is unavailable.
 */
const getRoadSegmentDistances = (coords) => __awaiter(void 0, void 0, void 0, function* () {
    if (coords.length < 2)
        return [];
    const allSegments = [];
    for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
        const chunk = coords.slice(i, i + OSRM_CHUNK_SIZE);
        if (chunk.length < 2)
            break;
        const segments = yield _osrmMatchSegments(chunk);
        allSegments.push(...segments);
    }
    return allSegments;
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
        // Fallback 1: Route API — always returns a road-following path for any 2+ waypoints
        try {
            const routeCoordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
            const routeRes = yield fetch(`${OSRM_BASE_URL}/route/v1/driving/${routeCoordStr}?overview=false`, { signal: AbortSignal.timeout(8000) });
            const routeData = yield routeRes.json();
            if (routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0) {
                return routeData.routes[0].distance / 1000;
            }
        }
        catch (_) {
            // fall through to haversine fallback
        }
        // Fallback 2: straight-line haversine sum (last resort)
        let total = 0;
        for (let j = 1; j < chunk.length; j++) {
            total += (0, exports.haversineDistance)(chunk[j - 1].lat, chunk[j - 1].lng, chunk[j].lat, chunk[j].lng);
        }
        return total;
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
