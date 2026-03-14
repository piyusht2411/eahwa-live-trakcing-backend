"use strict";
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
exports.getAdminsAndManagers = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = __importDefault(require("../models/user"));
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, email, password, role, department, phone, managerId, aadhaarNumber, address, employeeId, post } = req.body;
    try {
        const existingUser = yield user_1.default.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User exists" });
        }
        const user = new user_1.default(Object.assign(Object.assign(Object.assign(Object.assign({ name,
            email,
            password,
            role,
            department,
            phone }, (aadhaarNumber && { aadhaarNumber })), (address && { address })), (employeeId && { employeeId })), (post && { post })));
        yield user.save();
        // Auto-generate employeeId for employees
        if (role === "employee") {
            user.employeeId = `EMP${Date.now()}`;
            yield user.save();
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET || "", {
            expiresIn: "30d",
        });
        res.status(201).json({
            token,
            user: { id: user._id, name, email, role, department, phone, managerId, aadhaarNumber, address, employeeId, post },
        });
    }
    catch (error) {
        console.log("error", error);
        res.status(500).json({ message: "Server error" });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userName, password, fcmToken } = req.body;
    console.log("req", req.body);
    try {
        const user = yield user_1.default.findOne({
            $or: [{ email: userName }, { employeeId: userName }],
        }).select('+password');
        if (!user || !(yield bcrypt_1.default.compare(password, user.password))) {
            console.log("user not found");
            return res.status(401).json({ message: "Invalid credentials" });
        }
        if (fcmToken && typeof fcmToken === 'string' && fcmToken.length > 10 && fcmToken.length < 200) {
            user.fcmToken = fcmToken;
            yield user.save({ validateBeforeSave: false });
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET || "", {
            expiresIn: "30d",
        });
        res.status(200).json({
            ok: true,
            message: "User login successful",
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later.',
        });
    }
});
exports.login = login;
const getAdminsAndManagers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield user_1.default.find({
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
    }
    catch (error) {
        console.error("Error fetching admins and managers:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching admins and managers"
        });
    }
});
exports.getAdminsAndManagers = getAdminsAndManagers;
