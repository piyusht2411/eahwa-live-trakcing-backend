// src/services/googleSheetsService.ts
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

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

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

export const updatePunchSheet = async (punchData: any) => {

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_EMAIL || "",
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(
    process.env.GOOGLE_SHEET_ID || "",
    serviceAccountAuth
  );

  await doc.loadInfo();

  let sheet = doc.sheetsByTitle["Attendance"];

  if (!sheet) {
    sheet = await doc.addSheet({
      title: "Attendance",
      headerValues: ATTENDANCE_HEADERS,
    });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      await sheet.setHeaderRow(ATTENDANCE_HEADERS);
    }
  }

  const date = new Date(punchData.date);
  const time = new Date(punchData.time);
  const address =
    punchData.location?.address ||
    `${punchData.location?.lat}, ${punchData.location?.lng}`;

  await sheet.addRow({
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
};