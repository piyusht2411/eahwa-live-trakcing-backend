import { query } from "express-validator";

// Interface for query parameters
export interface OrderQueryParams {
  page?: string;
  limit?: string;
  month?: string;
  orderId?: string;
  sortBy?: string;
}

/**
 * Validation rules for getMyOrders query parameters
 * @returns Array of validation middleware for express-validator
 */
export const getMyOrdersValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage("Limit must be between 1 and 100"),
  query("month")
    .optional()
    .matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    .withMessage("Month must be in YYYY-MM format"),
  query("orderId")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Order ID cannot be empty if provided"),
  query("sortBy")
    .optional()
    .isIn(["pending_first", "delivered_first", "latest"])
    .withMessage(
      "sortBy must be one of: pending_first, delivered_first, latest"
    ),
];
