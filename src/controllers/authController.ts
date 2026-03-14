// src/controllers/authController.ts
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user";
import { clearGlobalAppDefaultCred } from "firebase-admin/lib/app/credential-factory";

export const register = async (req: Request, res: Response) => {
  const { name, email, password, role, department, phone, managerId, aadhaarNumber, address, employeeId, post } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User exists" });
    }

    const user = new User({
      name,
      email,
      password,
      role,
      department,
      phone,
      ...(aadhaarNumber && { aadhaarNumber }),
      ...(address && { address }),
      ...(employeeId && { employeeId }),
      ...(post && { post }),
    });

    await user.save();

    // Auto-generate employeeId for employees
    if (role === "employee") {
      user.employeeId = `EMP${Date.now()}`;
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "", {
      expiresIn: "30d",
    });

    res.status(201).json({
      token,
      user: { id: user._id, name, email, role, department, phone, managerId, aadhaarNumber, address, employeeId, post },
    });
  } catch (error) {
    console.log("error", error)
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { userName, password, fcmToken } = req.body;
  console.log("req", req.body);

  try {
    const user = await User.findOne({
      $or: [{ email: userName }, { employeeId: userName }],
    }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log("user not found")
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (fcmToken && typeof fcmToken === 'string' && fcmToken.length > 10 && fcmToken.length < 200) {
      user.fcmToken = fcmToken;
      await user.save({ validateBeforeSave: false });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "", {
      expiresIn: "30d",
    });

    res.status(200).json({
      ok: true,
      message: "User login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
    });
  }
};

export const getAdminsAndManagers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({ 
      role: { $in: ["admin", "manager"] },
      isActive: true // Optional: Only active users
    }).select("name _id").lean(); // Use lean() for better performance since we only need basic fields

    // Transform to include a display label for the frontend select (name + ID for clarity)
    const transformedUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.name
    }));

    res.status(200).json({
      success: true,
      data: transformedUsers
    });
  } catch (error) {
    console.error("Error fetching admins and managers:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error while fetching admins and managers" 
    });
  }
}