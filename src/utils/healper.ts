// Add to utils/helpers.ts (new file)
export const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculateSpeed = (log1: any, log2: any): number => {
  const dist = haversineDistance(log1.location.lat, log1.location.lng, log2.location.lat, log2.location.lng);
  const timeDiff = (log1.timestamp.getTime() - log2.timestamp.getTime()) / (1000 * 60 * 60); // hours
  return timeDiff > 0 ? dist / timeDiff : 0; // km/h
};

// Then in calculateDistance(logs: any[]): number {
//   return logs.reduce((total, log, i) => {
//     if (i === 0) return total;
//     return total + haversineDistance(logs[i-1].location.lat, logs[i-1].location.lng, log.location.lat, log.location.lng);
//   }, 0);
// }
