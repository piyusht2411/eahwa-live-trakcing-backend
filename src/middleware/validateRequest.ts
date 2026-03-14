import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

/**
 * Middleware to handle validation errors from express-validator
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 * @returns JSON response with validation errors if any, otherwise proceeds to next middleware
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
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
