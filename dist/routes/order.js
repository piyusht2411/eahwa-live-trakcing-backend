"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
// import { webhook } from "../controller/twillio";
const authMiddleware_1 = require("../middleware/authMiddleware");
const order_1 = require("../controller/order");
const validateRequest_1 = require("../middleware/validateRequest");
const validation_1 = require("../validation");
const router = express_1.default.Router();
/**
 * @route GET /orders/my
 * @description Fetch user's orders with pagination, filtering, and sorting
 * @queryParam {number} [page=1] - Page number for pagination
 * @queryParam {number} [limit=10] - Number of orders per page
 * @queryParam {string} [month] - Filter by month (YYYY-MM)
 * @queryParam {string} [orderId] - Search by order ID
 * @queryParam {string} [sortBy] - Sort by pending_first, delivered_first, or latest
 */
router.get("/my-orders", authMiddleware_1.authenticateToken, validation_1.getMyOrdersValidation, validateRequest_1.validateRequest, order_1.getMyOrders);
/**
 * @route GET /orders/all
 * @description Fetch all orders with pagination, filtering, and sorting (admin only)
 * @access Private (requires admin authentication)
 * @queryParam {number} [page=1] - Page number for pagination
 * @queryParam {number} [limit=10] - Number of orders per page
 * @queryParam {string} [month] - Filter by month (YYYY-MM)
 * @queryParam {string} [orderId] - Search by order ID
 * @queryParam {string} [sortBy] - Sort by pending_first, delivered_first, or latest
 */
router.get("/all-orders", authMiddleware_1.authenticateToken, validation_1.getMyOrdersValidation, validateRequest_1.validateRequest, order_1.getAllOrders);
router.post("/submit", authMiddleware_1.authenticateToken, order_1.submitOrder);
router.patch("/priority/:id", authMiddleware_1.authenticateToken, order_1.updateOrderPriority);
router.get("/dispatch", authMiddleware_1.authenticateToken, order_1.getDispatchOrders);
router.post("/deliver/:orderId", authMiddleware_1.authenticateToken, order_1.deliverOrder);
router.post("/pending/:orderId", authMiddleware_1.authenticateToken, order_1.markPending);
router.post("/cancel/:orderId", authMiddleware_1.authenticateToken, order_1.markCancel);
router.put("/:id", authMiddleware_1.authenticateToken, order_1.updateOrder);
router.delete("/:id", authMiddleware_1.authenticateToken, order_1.deleteOrder);
router.get("/:id", authMiddleware_1.authenticateToken, order_1.getOrderById);
// WhatsApp webhook
// router.post("/whatsapp/webhook", webhook);
exports.default = router;
