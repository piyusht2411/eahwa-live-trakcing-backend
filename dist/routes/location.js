"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/location.ts
const express_1 = require("express");
const locationControllers_1 = require("../controllers/locationControllers");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/log", auth_1.protect, locationControllers_1.logLocation);
router.get("/:userId", auth_1.protect, auth_2.hierarchyCheck, locationControllers_1.getLiveTrack);
router.get("/heatmap", auth_1.protect, locationControllers_1.getHeatMap);
exports.default = router;
