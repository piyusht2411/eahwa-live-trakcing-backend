// src/services/geoService.ts
import { haversineDistance } from "../utils/healper"; // Assume exported

export const checkGeoFence = (user: any, currentLoc: { lat: number; lng: number }, fenceRadius: number = 0.5) => { // km
  if (!user.homeLocation) return false;
  const dist = haversineDistance(user.homeLocation.lat, user.homeLocation.lng, currentLoc.lat, currentLoc.lng);
  return dist <= fenceRadius;
};

// In locationController.logLocation, after save:
// if (!checkGeoFence(req.user, JSON.parse(location))) {
//   await createAlert(req.user._id, "outside_geofence", "Outside registered area");
// }