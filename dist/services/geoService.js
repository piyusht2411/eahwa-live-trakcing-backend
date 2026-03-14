"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGeoFence = void 0;
// src/services/geoService.ts
const healper_1 = require("../utils/healper"); // Assume exported
const checkGeoFence = (user, currentLoc, fenceRadius = 0.5) => {
    if (!user.homeLocation)
        return false;
    const dist = (0, healper_1.haversineDistance)(user.homeLocation.lat, user.homeLocation.lng, currentLoc.lat, currentLoc.lng);
    return dist <= fenceRadius;
};
exports.checkGeoFence = checkGeoFence;
// In locationController.logLocation, after save:
// if (!checkGeoFence(req.user, JSON.parse(location))) {
//   await createAlert(req.user._id, "outside_geofence", "Outside registered area");
// }
