"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getDailyLeadById = exports.deleteDailyLead = exports.updateDailyLead = exports.getDailyLeadsByUser = exports.getAllDailyLeads = exports.createDailyLead = void 0;
const dailyLeadService = __importStar(require("../services/dailyLeadService"));
const createDailyLead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dailyLead = yield dailyLeadService.createDailyLead(req.body);
        return res.status(201).json(dailyLead);
    }
    catch (error) {
        return res.status(400).json({
            message: error.message || "Error creating daily lead entry",
            error: process.env.NODE_ENV === "development" ? error.stack : undefined,
        });
    }
});
exports.createDailyLead = createDailyLead;
const getAllDailyLeads = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const month = req.query.month ? Number(req.query.month) : undefined;
        const year = req.query.year ? Number(req.query.year) : undefined;
        const result = yield dailyLeadService.getAllDailyLeads(page, limit, month, year);
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(500).json({ message: "Error fetching daily leads", error: error.message });
    }
});
exports.getAllDailyLeads = getAllDailyLeads;
const getDailyLeadsByUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const month = req.query.month ? Number(req.query.month) : undefined;
        const year = req.query.year ? Number(req.query.year) : undefined;
        const result = yield dailyLeadService.getDailyLeadsByUser(userId, page, limit, month, year);
        return res.status(200).json(result);
    }
    catch (error) {
        return res.status(500).json({
            message: "Error fetching user's daily leads",
            error: error.message,
        });
    }
});
exports.getDailyLeadsByUser = getDailyLeadsByUser;
const updateDailyLead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updated = yield dailyLeadService.updateDailyLead(id, req.body);
        if (!updated) {
            return res.status(404).json({ message: "Daily lead entry not found" });
        }
        return res.status(200).json(updated);
    }
    catch (error) {
        return res.status(400).json({ message: error.message || "Error updating" });
    }
});
exports.updateDailyLead = updateDailyLead;
const deleteDailyLead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const deleted = yield dailyLeadService.deleteDailyLead(id);
        if (!deleted) {
            return res.status(404).json({ message: "Daily lead entry not found" });
        }
        return res.status(200).json({ message: "Deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ message: "Error deleting entry", error: error.message });
    }
});
exports.deleteDailyLead = deleteDailyLead;
const getDailyLeadById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const dailyLead = yield dailyLeadService.getById(id);
        if (!dailyLead)
            return res.status(404).json({ message: "Not found" });
        res.status(200).json(dailyLead);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching", error });
    }
});
exports.getDailyLeadById = getDailyLeadById;
