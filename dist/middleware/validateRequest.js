"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const express_validator_1 = require("express-validator");
/**
 * Middleware to handle validation errors from express-validator
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 * @returns JSON response with validation errors if any, otherwise proceeds to next middleware
 */
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array().map((err) => ({
                //@ts-ignoressss
                param: err.param,
                message: err.msg,
            })),
        });
    }
    next();
};
exports.validateRequest = validateRequest;
