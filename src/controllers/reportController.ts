// src/controllers/reportController.ts
import { Request, Response } from "express";
import * as ExcelJS from "exceljs";
import Punch from "../models/punch";
import Task from "../models/task";
import Performance from "../models/performance";
// Import other models

export const generateReport = async (req: Request, res: Response) => {
  const { type, period, userId, start, end } = req.query; // type: attendance, visits, performance, etc.

  try {
    let data: any[] = [];
    let query: any = { date: { $gte: new Date(start as string), $lte: new Date(end as string) } };

    // Hierarchy filter similar to others

    switch (type) {
      case "attendance":
        data = await Punch.find(query).populate("user", "name employeeId department");
        break;
      case "visits":
        data = await Task.find(query).populate("user", "name employeeId");
        break;
      case "performance":
        data = await Performance.find({ period, periodStart: { $gte: new Date(start as string) } }).populate("user", "name");
        break;
      // Add more
    }

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    sheet.columns = Object.keys(data[0] || {}).map((k) => ({ header: k, key: k }));
    sheet.addRows(data);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=report-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: "Error generating report" });
  }
};