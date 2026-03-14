"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpeed = exports.haversineDistance = void 0;
// Add to utils/helpers.ts (new file)
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
// Then in calculateDistance(logs: any[]): number {
//   return logs.reduce((total, log, i) => {
//     if (i === 0) return total;
//     return total + haversineDistance(logs[i-1].location.lat, logs[i-1].location.lng, log.location.lat, log.location.lng);
//   }, 0);
// }
