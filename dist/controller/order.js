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
exports.getOrderById = exports.deleteOrder = exports.updateOrder = exports.updateOrderPriority = exports.getDispatchOrders = exports.getAllOrders = exports.getMyOrders = exports.markCancel = exports.markPending = exports.deliverOrder = exports.submitOrder = void 0;
const orderService = __importStar(require("../services/orderService"));
const notificationService = __importStar(require("../services/notificationService"));
const order_1 = __importDefault(require("../model/order"));
const user_1 = __importDefault(require("../model/user"));
const submitOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        if (!data.piPdf) {
            res
                .status(400)
                .json({ success: false, message: "PI PDF URL is required." });
            return;
        }
        const existingOrder = yield orderService.findOrderByPiNumber(data.piNumber);
        if (existingOrder) {
            res.status(409).json({
                success: false,
                message: `Order with PI Number ${data.piNumber} already exists.`,
            });
            return;
        }
        const orderData = Object.assign(Object.assign({}, data), { quantity: parseInt(data.quantity), totalAmount: parseFloat(data.totalAmount), amountReceived: parseFloat(data.amountReceived), deadline: new Date(data.deadline), piPdf: data.piPdf, submittedBy: req.userId });
        const order = yield orderService.createOrder(orderData);
        const sid = yield notificationService.sendAccountsVerificationNotification(order);
        //@ts-ignore
        yield orderService.updateOrder(order._id, { accountsMessageSid: sid });
        res.status(200).json({ success: true, order });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to submit order.", error });
    }
});
exports.submitOrder = submitOrder;
const deliverOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { driverNumber, vehicleNumber, transporterName } = req.body;
        const order = yield orderService.findOrderById(req.params.orderId);
        if (!order ||
            (order.status !== "ready_for_dispatch" && order.status !== "pending")) {
            res
                .status(400)
                .json({ success: false, message: "Invalid order status." });
            return;
        }
        const updatedOrder = yield orderService.updateOrder(req.params.orderId, {
            status: "completed",
            driverNumber,
            vehicleNumber,
            transporterName,
            pendingReason: "-",
        });
        if (updatedOrder) {
            yield notificationService.sendDeepakConfirmation(updatedOrder);
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to confirm delivery.", error });
    }
});
exports.deliverOrder = deliverOrder;
const markPending = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pendingReason } = req.body;
        if (!pendingReason ||
            typeof pendingReason !== "string" ||
            !pendingReason.trim()) {
            res
                .status(400)
                .json({ success: false, message: "Pending reason is required." });
            return;
        }
        const order = yield orderService.findOrderById(req.params.orderId);
        if (!order || order.status !== "ready_for_dispatch") {
            res
                .status(400)
                .json({ success: false, message: "Invalid order status." });
            return;
        }
        yield orderService.updateOrder(req.params.orderId, {
            status: "pending",
            pendingReason,
        });
        res.status(200).json({ success: true });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to mark as pending.", error });
    }
});
exports.markPending = markPending;
const markCancel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { cancelReason } = req.body;
        if (!cancelReason ||
            typeof cancelReason !== "string" ||
            !cancelReason.trim()) {
            res
                .status(400)
                .json({ success: false, message: "Cancel reason is required." });
            return;
        }
        const order = yield orderService.findOrderById(req.params.orderId);
        if (!order || order.status !== "ready_for_dispatch") {
            res
                .status(400)
                .json({ success: false, message: "Invalid order status." });
            return;
        }
        yield orderService.updateOrder(req.params.orderId, {
            status: "cancelled",
            cancelReason,
        });
        res.status(200).json({ success: true });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to Cancel Order.", error });
    }
});
exports.markCancel = markCancel;
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.userId) {
            res.status(400).json({ success: false, message: "User ID is required." });
            return;
        }
        // Extract query parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const month = req.query.month; // Format: YYYY-MM
        const orderId = req.query.orderId;
        const sortBy = req.query.sortBy; // pending_first, delivered_first, or latest
        const result = yield orderService.getMyOrders(req.userId, page, limit, month, orderId, sortBy);
        res.status(200).json({
            success: true,
            orders: result.orders,
            totalPages: result.totalPages,
            currentPage: page,
            totalOrders: result.totalOrders,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch orders.", error });
    }
});
exports.getMyOrders = getMyOrders;
/**
 * Fetch all orders with pagination, filtering, and sorting (admin only)
 * @param req Express request object
 * @param res Express response object
 */
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const month = req.query.month;
        const orderId = req.query.orderId;
        const sortBy = req.query.sortBy;
        const username = req.query.username;
        const result = yield orderService.getAllOrders(page, limit, month, orderId, sortBy, username);
        res.status(200).json({
            success: true,
            orders: result.orders,
            totalPages: result.totalPages,
            currentPage: page,
            totalOrders: result.totalOrders,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch all orders.", error });
    }
});
exports.getAllOrders = getAllOrders;
const getDispatchOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { month, orderId } = req.query;
        const filters = {
            month: month ? parseInt(month) : undefined,
            orderId: orderId,
        };
        const orders = yield orderService.getDispatchOrders(filters);
        res.status(200).json({ success: true, orders });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch dispatch orders.",
            error,
        });
    }
});
exports.getDispatchOrders = getDispatchOrders;
const updateOrderPriority = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { priority } = req.body;
        if (typeof priority !== "number" || priority < 1) {
            res.status(400).json({
                success: false,
                message: "Priority must be a positive number.",
            });
            return;
        }
        const updatedOrder = yield order_1.default.findByIdAndUpdate(id, { priority }, { new: true, runValidators: true });
        if (!updatedOrder) {
            res.status(404).json({ success: false, message: "Order not found." });
            return;
        }
        res.status(200).json({
            success: true,
            message: "Priority updated successfully.",
            order: updatedOrder,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to update priority.", error });
    }
});
exports.updateOrderPriority = updateOrderPriority;
const updateOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = yield user_1.default.findById(userId);
        if (!user || !["admin"].includes(user.role)) {
            return res.status(403).json({
                message: "Access denied. Only HR and admin can update targets.",
            });
        }
        const updateData = req.body;
        // Validate ObjectId format
        if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID format",
            });
        }
        // Validate required fields for specific updates
        if (updateData.status === "completed" && !updateData.remark) {
            return res.status(400).json({
                success: false,
                message: "Remark is required when marking order as completed.",
            });
        }
        if (updateData.amountReceived &&
            updateData.amountReceived > updateData.totalAmount) {
            return res.status(400).json({
                success: false,
                message: "Amount received cannot exceed total amount.",
            });
        }
        // Check if order exists
        const existingOrder = yield orderService.findOrderById(id);
        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }
        // Prepare update data with proper type conversion
        const processedUpdateData = Object.assign(Object.assign({}, updateData), { quantity: updateData.quantity ? parseInt(updateData.quantity) : undefined, totalAmount: updateData.totalAmount
                ? parseFloat(updateData.totalAmount)
                : undefined, amountReceived: updateData.amountReceived
                ? parseFloat(updateData.amountReceived)
                : undefined, deadline: updateData.deadline ? new Date(updateData.deadline) : undefined, priority: updateData.priority ? parseInt(updateData.priority) : undefined });
        // Remove undefined values
        Object.keys(processedUpdateData).forEach((key) => {
            if (processedUpdateData[key] === undefined) {
                delete processedUpdateData[key];
            }
        });
        // Ensure at least one field to update
        if (Object.keys(processedUpdateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided for update.",
            });
        }
        const updatedOrder = yield orderService.updateOrder(id, processedUpdateData);
        return res.status(200).json({ success: true, order: updatedOrder });
    }
    catch (error) {
        console.error("Error updating order:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update order.",
            error: error.message,
        });
    }
});
exports.updateOrder = updateOrder;
const deleteOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = yield user_1.default.findById(userId);
        if (!user || !["admin"].includes(user.role)) {
            return res.status(403).json({
                message: "Access denied. Only HR and admin can update targets.",
            });
        }
        // Validate ObjectId format
        if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID format",
            });
        }
        // Check if order exists and get order details
        const existingOrder = yield orderService.findOrderById(id);
        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }
        // Prevent deletion of completed orders
        if (existingOrder.status === "completed") {
            return res.status(400).json({
                success: false,
                message: "Cannot delete completed orders.",
            });
        }
        // Check if order has been dispatched
        if (existingOrder.vehicleNumber || existingOrder.driverNumber) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete dispatched orders.",
            });
        }
        const deletedOrder = yield orderService.deleteOrder(id);
        return res.status(200).json({
            success: true,
            message: "Order deleted successfully",
            order: deletedOrder,
        });
    }
    catch (error) {
        console.error("Error deleting order:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete order.",
            error: error.message,
        });
    }
});
exports.deleteOrder = deleteOrder;
// GET Order by ID
const getOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const { id } = req.params;
        // Validate ObjectId format
        if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid order ID format",
            });
            return;
        }
        // Fetch order with populated user data
        const order = yield orderService.findOrderById(id);
        if (!order) {
            res.status(404).json({
                success: false,
                message: "Order not found.",
            });
            return;
        }
        // Transform data for frontend - handle both Mongoose document and plain object
        let orderData = order;
        // If it's a Mongoose document (without lean), convert to plain object
        if (typeof order.toObject === "function") {
            orderData = order.toObject();
        }
        // If it's already a plain object (from lean), use as-is
        // orderData is already a plain object
        // Transform date for frontend (datetime-local input format)
        const transformedOrderData = Object.assign(Object.assign({}, orderData), { deadline: orderData.deadline
                ? new Date(orderData.deadline).toISOString().slice(0, 16)
                : "", 
            // Convert numbers back to strings for form inputs
            quantity: ((_a = orderData.quantity) === null || _a === void 0 ? void 0 : _a.toString()) || "", totalAmount: ((_b = orderData.totalAmount) === null || _b === void 0 ? void 0 : _b.toString()) || "", amountReceived: ((_c = orderData.amountReceived) === null || _c === void 0 ? void 0 : _c.toString()) || "", priority: orderData.priority !== null && orderData.priority !== undefined
                ? orderData.priority.toString()
                : "", 
            // Ensure piPdf is always a string
            piPdf: orderData.piPdf || "", 
            // Include additional fields that might be useful
            status: orderData.status || "", remark: orderData.remark || "", pendingReason: orderData.pendingReason || "", 
            // Virtual field for pendency
            pendency: orderData.deadline &&
                new Date(orderData.deadline) < new Date() &&
                orderData.status !== "completed" });
        // Remove _id if you don't want to send it, or keep it for reference
        // delete transformedOrderData._id;
        res.status(200).json({
            success: true,
            order: transformedOrderData,
        });
    }
    catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order.",
            error: error.message,
        });
    }
});
exports.getOrderById = getOrderById;
