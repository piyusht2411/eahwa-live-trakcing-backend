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
exports.getRequestsByMonthForExport = exports.getRequestById = exports.getAllRequests = exports.updateRequestStatus = exports.submitRequest = void 0;
const request_1 = __importDefault(require("../model/request"));
const user_1 = __importDefault(require("../model/user"));
const admin = __importStar(require("firebase-admin"));
const sendNotificationToRole = (role, title, body, data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield user_1.default.find({
            role,
            fcmToken: { $ne: null },
        }).select('fcmToken');
        const tokens = users.map((u) => u.fcmToken).filter(Boolean);
        if (tokens.length === 0)
            return;
        const message = {
            notification: { title, body },
            data,
            tokens,
        };
        const response = yield admin.messaging().sendEachForMulticast(message);
        console.log(`✅ Notification sent to ${role}s | Success: ${response.successCount}, Failed: ${response.failureCount}`);
    }
    catch (err) {
        console.error(`❌ Failed to send notification to ${role}:`, err);
    }
});
// ====================== 1. SUBMIT REQUEST (from Expo app) ======================
const submitRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, productDescription, vendorName, userPhoneNumber, amount, time } = req.body;
    if (!name || !productDescription || !vendorName || !userPhoneNumber || amount == null || !time) {
        res.status(400).json({ success: false, message: 'All fields required' });
        return;
    }
    try {
        const newRequest = new request_1.default({
            name,
            productDescription,
            vendorName,
            userPhoneNumber,
            amount: Number(amount),
            time,
            status: 'pending',
        });
        yield newRequest.save();
        // === SEND TO ADMINS ONLY ===
        yield sendNotificationToRole('admin', '🛒 New Request Received', `${name} requested ${productDescription} • ₹${amount}`, {
            requestId: String(newRequest._id),
            type: 'new_request',
            screen: 'RequestDetail',
        });
        res.status(201).json({
            success: true,
            message: 'Request submitted. Admins notified.',
            data: newRequest,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});
exports.submitRequest = submitRequest;
// ====================== 2. UPDATE STATUS (Admin PUT) ======================
const updateRequestStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
        res.status(400).json({ success: false, message: "Status must be 'accepted' or 'rejected'" });
        return;
    }
    if (status === 'rejected' && !rejectionReason) {
        res.status(400).json({ success: false, message: 'Rejection reason required' });
        return;
    }
    try {
        const updateData = { status };
        if (status === 'rejected')
            updateData.rejectionReason = rejectionReason;
        const updatedRequest = yield request_1.default.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedRequest) {
            res.status(404).json({ success: false, message: 'Request not found' });
            return;
        }
        // === SEND TO GUARDS ONLY ===
        const statusText = status === 'accepted' ? '✅ Accepted' : '❌ Rejected';
        yield sendNotificationToRole('guard', `Request ${statusText}`, `${updatedRequest.name} - ${updatedRequest.productDescription}`, {
            requestId: String(updatedRequest._id),
            type: 'status_update',
            status: updatedRequest.status,
            rejectionReason: updatedRequest.rejectionReason || '',
        });
        res.status(200).json({
            success: true,
            message: `Request ${status} successfully`,
            data: updatedRequest,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});
exports.updateRequestStatus = updateRequestStatus;
const getAllRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // ────────────────────────────────────────────────
        // 1. Extract & parse query parameters
        // ────────────────────────────────────────────────
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const monthStr = req.query.month; // 1–12
        const yearStr = req.query.year; // e.g. 2025
        // Validate pagination values
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(100, Math.max(1, limit)); // cap at 100 to prevent abuse
        // Build base query
        const query = {};
        // Status filter (existing)
        if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
            query.status = status;
        }
        // Month + Year filter (both required for the filter to apply)
        if (monthStr && yearStr) {
            const month = parseInt(monthStr);
            const year = parseInt(yearStr);
            if (!isNaN(month) && !isNaN(year) && month >= 1 && month <= 12) {
                const startOfMonth = new Date(year, month - 1, 1); // e.g. 2025-03-01
                const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999); // e.g. 2025-03-31 23:59:59.999
                query.createdAt = {
                    $gte: startOfMonth,
                    $lte: endOfMonth,
                };
            }
        }
        // ────────────────────────────────────────────────
        // 2. Get total count for pagination metadata
        // ────────────────────────────────────────────────
        const total = yield request_1.default.countDocuments(query);
        // ────────────────────────────────────────────────
        // 3. Fetch paginated & sorted data
        // ────────────────────────────────────────────────
        const requests = yield request_1.default.find(query)
            .sort({ createdAt: -1 }) // newest first
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .lean();
        // ────────────────────────────────────────────────
        // 4. Build response with pagination info
        // ────────────────────────────────────────────────
        const totalPages = Math.ceil(total / safeLimit);
        const hasNextPage = safePage < totalPages;
        const hasPrevPage = safePage > 1;
        res.status(200).json({
            success: true,
            data: requests,
            pagination: {
                total,
                page: safePage,
                limit: safeLimit,
                totalPages,
                hasNextPage,
                hasPrevPage,
                countThisPage: requests.length,
            },
            filtersApplied: {
                status: status || null,
                month: monthStr ? parseInt(monthStr) : null,
                year: yearStr ? parseInt(yearStr) : null,
            },
        });
    }
    catch (error) {
        console.error('getAllRequests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch requests',
            error: error.message,
        });
    }
});
exports.getAllRequests = getAllRequests;
// ======================
// 4. GET - Single request by ID
// ======================
const getRequestById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    try {
        const request = yield request_1.default.findById(id);
        if (!request) {
            res.status(404).json({ success: false, message: 'Request not found' });
            return;
        }
        res.status(200).json({ success: true, data: request });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch request',
            error: error.message,
        });
    }
});
exports.getRequestById = getRequestById;
/**
 * GET - All requests for a specific month/year (NO pagination)
 * Used by React Native Expo app to export data to Excel using xlsx
 *
 * Example calls:
 * GET /api/request/export-by-month?month=3&year=2025
 * GET /api/request/export-by-month?month=12&year=2024&status=accepted
 */
const getRequestsByMonthForExport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { month: monthStr, year: yearStr, status } = req.query;
        // Validation
        if (!monthStr || !yearStr) {
            res.status(400).json({
                success: false,
                message: 'month and year query parameters are required (e.g. ?month=3&year=2025)',
            });
            return;
        }
        const month = parseInt(monthStr);
        const year = parseInt(yearStr);
        if (isNaN(month) ||
            isNaN(year) ||
            month < 1 ||
            month > 12 ||
            year < 2020 || // adjust range as needed
            year > 2030) {
            res.status(400).json({
                success: false,
                message: 'Invalid month (1-12) or year',
            });
            return;
        }
        // Build MongoDB date range for full month
        const startOfMonth = new Date(year, month - 1, 1); // 2025-03-01 00:00:00
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999); // 2025-03-31 23:59:59.999
        const query = {
            createdAt: {
                $gte: startOfMonth,
                $lte: endOfMonth,
            },
        };
        // Optional status filter
        if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
            query.status = status;
        }
        // Fetch ALL records (no limit, no skip)
        const requests = yield request_1.default.find(query)
            .sort({ createdAt: -1 }) // newest first
            .lean(); // faster & plain JS objects
        res.status(200).json({
            success: true,
            count: requests.length,
            month,
            year,
            status: status || 'all',
            data: requests,
        });
    }
    catch (error) {
        console.error('Export API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch requests for export',
            error: error.message,
        });
    }
});
exports.getRequestsByMonthForExport = getRequestsByMonthForExport;
