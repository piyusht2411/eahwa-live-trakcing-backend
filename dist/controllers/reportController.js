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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReport = void 0;
const ExcelJS = __importStar(require("exceljs"));
const punch_1 = __importDefault(require("../models/punch"));
const task_1 = __importDefault(require("../models/task"));
const performance_1 = __importDefault(require("../models/performance"));
// Import other models
const generateReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { type, period, userId, start, end } = req.query; // type: attendance, visits, performance, etc.
    try {
        let data = [];
        let query = { date: { $gte: new Date(start), $lte: new Date(end) } };
        // Hierarchy filter similar to others
        switch (type) {
            case "attendance":
                data = yield punch_1.default.find(query).populate("user", "name employeeId department");
                break;
            case "visits":
                data = yield task_1.default.find(query).populate("user", "name employeeId");
                break;
            case "performance":
                data = yield performance_1.default.find({ period, periodStart: { $gte: new Date(start) } }).populate("user", "name");
                break;
            // Add more
        }
        // Generate Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Report");
        sheet.columns = Object.keys(data[0] || {}).map((k) => ({ header: k, key: k }));
        sheet.addRows(data);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=report-${Date.now()}.xlsx`);
        yield workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        res.status(500).json({ message: "Error generating report" });
    }
});
exports.generateReport = generateReport;
