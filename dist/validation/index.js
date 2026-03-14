"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyOrdersValidation = void 0;
const express_validator_1 = require("express-validator");
/**
 * Validation rules for getMyOrders query parameters
 * @returns Array of validation middleware for express-validator
 */
exports.getMyOrdersValidation = [
    (0, express_validator_1.query)("page")
        .optional()
        .isInt({ min: 1 })
        .toInt()
        .withMessage("Page must be a positive integer"),
    (0, express_validator_1.query)("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .toInt()
        .withMessage("Limit must be between 1 and 100"),
    (0, express_validator_1.query)("month")
        .optional()
        .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
        .withMessage("Month must be in YYYY-MM format"),
    (0, express_validator_1.query)("orderId")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Order ID cannot be empty if provided"),
    (0, express_validator_1.query)("sortBy")
        .optional()
        .isIn(["pending_first", "delivered_first", "latest"])
        .withMessage("sortBy must be one of: pending_first, delivered_first, latest"),
];
