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
exports.updateGeofence = exports.getGeofences = exports.createGeofence = void 0;
const geofence_1 = __importDefault(require("../models/geofence"));
const createGeofence = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, department, center, radius } = req.body;
        const createdBy = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const geofence = new geofence_1.default({
            name,
            department,
            center,
            radius,
            createdBy
        });
        yield geofence.save();
        res.status(201).json({
            success: true,
            message: "Geofence created successfully",
            data: geofence
        });
    }
    catch (error) {
        console.error("Create geofence error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.createGeofence = createGeofence;
const getGeofences = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { department } = req.query;
        let query = {};
        if (department) {
            query.department = department;
        }
        const geofences = yield geofence_1.default.find(query)
            .populate("createdBy", "name employeeId")
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: geofences
        });
    }
    catch (error) {
        console.error("Get geofences error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getGeofences = getGeofences;
const updateGeofence = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const geofence = yield geofence_1.default.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!geofence) {
            return res.status(404).json({ success: false, message: "Geofence not found" });
        }
        res.status(200).json({
            success: true,
            message: "Geofence updated successfully",
            data: geofence
        });
    }
    catch (error) {
        console.error("Update geofence error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.updateGeofence = updateGeofence;
