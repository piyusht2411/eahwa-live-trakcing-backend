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
exports.updatePunchSheet = void 0;
const ATTENDANCE_HEADERS = [
    "Employee Name",
    "Employee ID",
    "Department",
    "Manager",
    "Date",
    "Time",
    "Location",
    "Selfie URL",
    "Type",
];
const formatDate = (date) => {
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    });
};
const formatTime = (date) => {
    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
    });
};
const updatePunchSheet = (punchData) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    // Dynamic import → forces ESM version (works from CJS)
    const { GoogleSpreadsheet } = yield Promise.resolve().then(() => __importStar(require("google-spreadsheet")));
    const { JWT } = yield Promise.resolve().then(() => __importStar(require("google-auth-library")));
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_EMAIL || "",
        key: ((_a = process.env.GOOGLE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, "\n")) || "",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID || "", serviceAccountAuth);
    yield doc.loadInfo();
    let sheet = doc.sheetsByTitle["Attendance"];
    if (!sheet) {
        sheet = yield doc.addSheet({
            title: "Attendance",
            headerValues: ATTENDANCE_HEADERS,
        });
    }
    else {
        try {
            yield sheet.loadHeaderRow();
        }
        catch (_e) {
            yield sheet.setHeaderRow(ATTENDANCE_HEADERS);
        }
    }
    const date = new Date(punchData.date);
    const time = new Date(punchData.time);
    const address = ((_b = punchData.location) === null || _b === void 0 ? void 0 : _b.address) ||
        `${(_c = punchData.location) === null || _c === void 0 ? void 0 : _c.lat}, ${(_d = punchData.location) === null || _d === void 0 ? void 0 : _d.lng}`;
    yield sheet.addRow({
        "Employee Name": punchData.employeeName,
        "Employee ID": punchData.employeeId,
        "Department": punchData.department,
        "Manager": punchData.manager || "N/A",
        "Date": formatDate(date),
        "Time": formatTime(time),
        "Location": address,
        "Selfie URL": punchData.selfie || "N/A",
        "Type": punchData.type,
    });
});
exports.updatePunchSheet = updatePunchSheet;
