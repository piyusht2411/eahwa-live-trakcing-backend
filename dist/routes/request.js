"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const request_1 = require("../controller/request");
const router = (0, express_1.Router)();
// ────────────────────────────────────────────────
//  Specific (non-parameter) routes FIRST
// ────────────────────────────────────────────────
router.post('/submit-request', request_1.submitRequest);
router.get('/export-by-month', request_1.getRequestsByMonthForExport); // ← moved UP
router.get('/', request_1.getAllRequests);
// ────────────────────────────────────────────────
//  Parameterized routes AFTER all static routes
// ────────────────────────────────────────────────
router.put('/:id/status', request_1.updateRequestStatus);
router.get('/:id', request_1.getRequestById);
exports.default = router;
