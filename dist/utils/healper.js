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
 * Get road-based total distance (km) for an ordered array of GPS coordinates.
 * Uses OSRM routing API; falls back to haversine sum if OSRM is unavailable.
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
        totalKm += yield _osrmChunkDistance(chunk);
    }
    return parseFloat(totalKm.toFixed(2));
});
exports.getRoadDistance = getRoadDistance;
/**
 * Get road-based distance per segment (km) for an ordered array of GPS coordinates.
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
        const segments = yield _osrmChunkSegments(chunk);
        allSegments.push(...segments);
    }
    return allSegments;
});
exports.getRoadSegmentDistances = getRoadSegmentDistances;
function _osrmChunkDistance(chunk) {
    return __awaiter(this, void 0, void 0, function* () {
        const coordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
        try {
            const res = yield fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=false`, {
                signal: AbortSignal.timeout(5000),
            });
            const data = yield res.json();
            if (data.code === "Ok")
                return data.routes[0].distance / 1000;
        }
        catch (_) {
            // fall through to haversine fallback
        }
        // Fallback: sum haversine distances for the chunk
        let total = 0;
        for (let j = 1; j < chunk.length; j++) {
            total += (0, exports.haversineDistance)(chunk[j - 1].lat, chunk[j - 1].lng, chunk[j].lat, chunk[j].lng);
        }
        return total;
    });
}
function _osrmChunkSegments(chunk) {
    return __awaiter(this, void 0, void 0, function* () {
        const coordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
        try {
            const res = yield fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=false`, {
                signal: AbortSignal.timeout(5000),
            });
            const data = yield res.json();
            if (data.code === "Ok") {
                return data.routes[0].legs.map((leg) => leg.distance / 1000);
            }
        }
        catch (_) {
            // fall through to haversine fallback
        }
        // Fallback: haversine per segment
        return chunk.slice(1).map((c, i) => (0, exports.haversineDistance)(chunk[i].lat, chunk[i].lng, c.lat, c.lng));
    });
}
