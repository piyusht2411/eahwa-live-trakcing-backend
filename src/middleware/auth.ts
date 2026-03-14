// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user";

interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as any;
    req.user = await User.findById(decoded.id);
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

// Role-based for hierarchy: Managers see only team
export const hierarchyCheck = (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId } = req.params;
  const currentUser = req.user;

  if (currentUser.role === "admin" || currentUser.role === "hr") {
    return next();
  }

  if (currentUser.role === "manager") {
    // Check if userId is in manages or self
    if (currentUser._id.toString() === userId || currentUser.manages.some((m: any) => m.toString() === userId)) {
      return next();
    }
  }

  if (currentUser.role === "employee" && currentUser._id.toString() === userId) {
    return next();
  }

  return res.status(403).json({ message: "Access denied" });
};