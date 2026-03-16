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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePunchSheet = void 0;
// src/services/googleSheetsService.ts
const google_spreadsheet_1 = require("google-spreadsheet");
const google_auth_library_1 = require("google-auth-library");
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
    const serviceAccountAuth = new google_auth_library_1.JWT({
        email: process.env.GOOGLE_SERVICE_EMAIL || "",
        key: ((_a = process.env.GOOGLE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, "\n")) || "",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const doc = new google_spreadsheet_1.GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID || "", serviceAccountAuth);
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
