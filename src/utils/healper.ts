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

const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_CHUNK_SIZE = 100; // max waypoints per OSRM request

/**
 * Get road-based total distance (km) for an ordered array of GPS coordinates.
 * Uses OSRM routing API; falls back to haversine sum if OSRM is unavailable.
 */
export const getRoadDistance = async (coords: { lat: number; lng: number }[]): Promise<number> => {
  if (coords.length < 2) return 0;

  let totalKm = 0;
  // Process in overlapping chunks so chunk boundaries share an endpoint
  for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
    const chunk = coords.slice(i, i + OSRM_CHUNK_SIZE);
    if (chunk.length < 2) break;
    totalKm += await _osrmChunkDistance(chunk);
  }

  return parseFloat(totalKm.toFixed(2));
};

/**
 * Get road-based distance per segment (km) for an ordered array of GPS coordinates.
 * Returns an array of length coords.length - 1 where result[i] = road distance from coords[i] to coords[i+1].
 * Falls back to haversine per segment if OSRM is unavailable.
 */
export const getRoadSegmentDistances = async (coords: { lat: number; lng: number }[]): Promise<number[]> => {
  if (coords.length < 2) return [];

  const allSegments: number[] = [];
  for (let i = 0; i < coords.length - 1; i += OSRM_CHUNK_SIZE - 1) {
    const chunk = coords.slice(i, i + OSRM_CHUNK_SIZE);
    if (chunk.length < 2) break;
    const segments = await _osrmChunkSegments(chunk);
    allSegments.push(...segments);
  }

  return allSegments;
};

async function _osrmChunkDistance(chunk: { lat: number; lng: number }[]): Promise<number> {
  const coordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
  try {
    const res = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=false`, {
      signal: AbortSignal.timeout(5000),
    });
    const data: any = await res.json();
    if (data.code === "Ok") return data.routes[0].distance / 1000;
  } catch (_) {
    // fall through to haversine fallback
  }

  // Fallback: sum haversine distances for the chunk
  let total = 0;
  for (let j = 1; j < chunk.length; j++) {
    total += haversineDistance(chunk[j - 1].lat, chunk[j - 1].lng, chunk[j].lat, chunk[j].lng);
  }
  return total;
}

async function _osrmChunkSegments(chunk: { lat: number; lng: number }[]): Promise<number[]> {
  const coordStr = chunk.map(c => `${c.lng},${c.lat}`).join(";");
  try {
    const res = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordStr}?overview=false`, {
      signal: AbortSignal.timeout(5000),
    });
    const data: any = await res.json();
    if (data.code === "Ok") {
      return (data.routes[0].legs as any[]).map((leg: any) => leg.distance / 1000);
    }
  } catch (_) {
    // fall through to haversine fallback
  }

  // Fallback: haversine per segment
  return chunk.slice(1).map((c, i) =>
    haversineDistance(chunk[i].lat, chunk[i].lng, c.lat, c.lng)
  );
}
