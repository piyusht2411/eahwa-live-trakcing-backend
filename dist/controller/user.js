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
exports.updateLastWorkingDate = exports.getVisitorsOfEmployee = exports.getVisitors = exports.deleteTargetLeadFile = exports.deleteRegularLeadFile = exports.getLeads = exports.getTargetFileUploadHistory = exports.getFileUploadHistory = exports.createLeadsHistory = exports.processExcelAndCreateLeads = exports.addVisitor = exports.getEmployeeDetails = exports.getTopEmployees = exports.updateTarget = exports.getAllEmployees = exports.resetPassword = exports.verifyOtp = exports.forgotPassword = exports.getManagedEmployees = exports.updateEmployee = exports.login = exports.register = void 0;
const mongoose_1 = require("mongoose");
const bcrypt_1 = require("bcrypt");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const axios_1 = __importDefault(require("axios"));
const XLSX = __importStar(require("xlsx"));
const user_1 = __importDefault(require("../model/user"));
const lead_1 = __importDefault(require("../model/lead"));
const leadFile_1 = __importDefault(require("../model/leadFile"));
const targetLeadFile_1 = __importDefault(require("../model/targetLeadFile"));
const visitor_1 = __importDefault(require("../model/visitor"));
const otplib_1 = require("otplib");
const emailer_1 = require("../utils/emailer");
const healper_1 = require("../utils/healper");
const mongoose_2 = __importDefault(require("mongoose"));
const register = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_2.default.startSession();
    session.startTransaction();
    try {
        const { name, email, password, address, aadhaarNumber, role, employeeId, phone, joiningDate, post, targetAchieved, profilePicture, managedBy, // This will be the manager's ID (sent from frontend)
         } = req.body;
        // Validation
        const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        if (!role) {
            return res.status(400).json({ message: "Role is required" });
        }
        // Check if user already exists
        const existingUser = yield user_1.default.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }
        // Create new user
        const newUser = new user_1.default({
            name,
            email,
            password,
            address,
            aadhaarNumber,
            role,
            employeeId,
            phone,
            joiningDate,
            post,
            targetAchieved,
            profilePicture,
            managedBy: managedBy || null, // Set manager if provided
        });
        // If there's a manager, update their `manages` array
        if (managedBy) {
            const manager = yield user_1.default.findById(managedBy).session(session);
            if (!manager) {
                yield session.abortTransaction();
                return res.status(404).json({ message: "Manager not found" });
            }
            // Optional: restrict who can be a manager
            if (!["manager", "admin", "hr", "admin-plant"].includes(manager.role)) {
                yield session.abortTransaction();
                return res.status(400).json({ message: "Assigned manager does not have permission to manage employees" });
            }
            // Avoid duplicate entry
            if (!manager.manages.includes(newUser._id)) {
                manager.manages.push(newUser._id);
                yield manager.save({ session });
            }
        }
        yield newUser.save({ session });
        yield session.commitTransaction();
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                managedBy: newUser.managedBy,
            },
        });
    }
    catch (err) {
        yield session.abortTransaction();
        console.error("Registration error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
    finally {
        session.endSession();
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userName, password, fcmToken } = req.body;
        if (!userName || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username/Email and password are required',
            });
        }
        const user = yield user_1.default.findOne({
            $or: [{ email: userName }, { employeeId: userName }],
        }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        const isMatch = (0, bcrypt_1.compareSync)(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        if (fcmToken && typeof fcmToken === 'string' && fcmToken.length > 10 && fcmToken.length < 200) {
            user.fcmToken = fcmToken;
            yield user.save({ validateBeforeSave: false });
        }
        const authToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET_KEY || " ", { expiresIn: "30d" });
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET_KEY || " ", { expiresIn: "60d" });
        res.cookie("authToken", authToken, { httpOnly: true });
        res.cookie("refreshToken", refreshToken, { httpOnly: true });
        res.header("Authorization", `Bearer ${authToken}`);
        res.status(200).json({
            ok: true,
            message: "User login successful",
            user: user,
            authToken: authToken,
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again later.',
        });
    }
});
exports.login = login;
const updateEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const updateData = Object.assign({}, req.body);
        delete updateData.password;
        const user = yield user_1.default.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (((_a = updateData.ratings) === null || _a === void 0 ? void 0 : _a.history) &&
            Array.isArray(updateData.ratings.history)) {
            updateData.ratings.history.forEach((newEntry) => {
                const { month, managerRating, adminRating, managerId, adminId } = newEntry;
                if (month) {
                    const existingEntry = user.ratings.history.find((entry) => entry.month === month);
                    if (existingEntry) {
                        if (managerRating !== undefined)
                            existingEntry.managerRating = managerRating;
                        if (adminRating !== undefined)
                            existingEntry.adminRating = adminRating;
                        if (managerId !== undefined)
                            existingEntry.managerId = managerId;
                        if (adminId !== undefined)
                            existingEntry.adminId = adminId;
                    }
                    else {
                        user.ratings.history.push({
                            month,
                            managerRating: managerRating !== null && managerRating !== void 0 ? managerRating : null,
                            adminRating: adminRating !== null && adminRating !== void 0 ? adminRating : null,
                            managerId: managerId !== null && managerId !== void 0 ? managerId : null,
                            adminId: adminId !== null && adminId !== void 0 ? adminId : null,
                        });
                    }
                }
            });
            delete updateData.ratings;
        }
        Object.assign(user, updateData);
        const updatedUser = yield user.save();
        const responseUser = updatedUser.toObject();
        // delete responseUser.password;
        // delete responseUser.passwordResetToken;
        res.status(200).json(responseUser);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
exports.updateEmployee = updateEmployee;
const getManagedEmployees = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const paramId = req.params.id;
        const authUserId = req.userId;
        const userId = paramId ? paramId : authUserId;
        const managedEmployees = yield user_1.default.find({ managedBy: userId })
            .select("-password -passwordResetToken")
            .lean();
        if (!managedEmployees || managedEmployees.length === 0) {
            return res.status(200).json({
                message: "No employees managed by this user",
                employees: [],
            });
        }
        res.status(200).json({
            message: "Managed employees retrieved successfully",
            employees: managedEmployees,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});
exports.getManagedEmployees = getManagedEmployees;
const forgotPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const user = yield user_1.default.findOne({ email });
        if (!user) {
            return res
                .status(400)
                .json({ message: "User with this email does not exist" });
        }
        const otp = otplib_1.authenticator.generateSecret().slice(0, 6);
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        user.passwordResetToken = otp;
        user.tokenExpire = otpExpiry;
        yield user.save();
        (0, emailer_1.sendMail)(user.email, "Password Reset OTP", `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`);
        res.status(200).json({ message: "OTP sent to your email" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});
exports.forgotPassword = forgotPassword;
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp } = req.body;
        const user = yield user_1.default.findOne({ email });
        if (!user) {
            return res
                .status(400)
                .json({ message: "User with this email does not exist" });
        }
        if (user.passwordResetToken.length === 0 ||
            (user.tokenExpire && user.tokenExpire < new Date())) {
            return res.status(400).json({ message: "OTP has expired" });
        }
        const isMatch = (0, bcrypt_1.compareSync)(otp, user.passwordResetToken);
        if (!isMatch) {
            return res.status(409).json({
                message: "Invalid otp",
            });
        }
        user.isVerified = true;
        yield user.save();
        res.status(200).json({ message: "OTP verified successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});
exports.verifyOtp = verifyOtp;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, newPassword } = req.body;
        const user = yield user_1.default.findOne({ email });
        if (!user) {
            return res
                .status(400)
                .json({ message: "User with this email does not exist" });
        }
        if (!user.isVerified) {
            return res.status(400).json({
                message: "User is not verified. Please verify the OTP first.",
            });
        }
        user.password = newPassword;
        user.passwordResetToken = "";
        user.tokenExpire = null;
        user.isVerified = false;
        yield user.save();
        res.status(200).json({ message: "Password reset successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});
exports.resetPassword = resetPassword;
const getAllEmployees = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield user_1.default.findById(req.userId);
        if (!user) {
            return res.status(403).json({ message: "Forbidden: User not found" });
        }
        if (!["hr", "admin", "manager"].includes(user.role)) {
            return res
                .status(403)
                .json({ message: "Forbidden: Insufficient permissions" });
        }
        const query = user.role === "admin"
            ? { role: { $in: ["employee", "hr"] } }
            : { role: "employee" };
        const employees = yield user_1.default.find(query).select("-password");
        res.status(200).json({ employees, requestingUser: user });
    }
    catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
});
exports.getAllEmployees = getAllEmployees;
const updateTarget = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { id } = req.params;
        const { battery, eRickshaw, scooty, month } = req.body;
        const requesterId = req.userId;
        const requester = yield user_1.default.findById(requesterId);
        if (!requester || !["hr", "admin", "manager"].includes(requester.role)) {
            return res.status(403).json({
                message: "Access denied. Only HR and admin can update targets.",
            });
        }
        if (!battery || !eRickshaw || !scooty) {
            return res.status(400).json({
                message: "All target fields (battery, eRickshaw, scooty) are required.",
            });
        }
        const validateTarget = (target) => {
            return target.total !== undefined && target.completed !== undefined;
        };
        if (!validateTarget(battery) ||
            !validateTarget(eRickshaw) ||
            !validateTarget(scooty)) {
            return res.status(400).json({
                message: "Each target must include both 'total' and 'completed' values.",
            });
        }
        const user = yield user_1.default.findById(id);
        if (!user) {
            return res.status(404).json({ message: "Employee not found." });
        }
        const updateField = (newTarget) => {
            const completed = newTarget.completed;
            const total = newTarget.total;
            const extra = completed > total ? completed - total : 0;
            return {
                total,
                completed,
                pending: total - Math.min(completed, total),
                extra,
            };
        };
        const updatedTargets = {
            battery: {
                total: battery.total,
                completed: battery.completed,
                pending: battery.total - Math.min(battery.completed, battery.total),
                extra: battery.completed > battery.total
                    ? battery.completed - battery.total
                    : 0,
                current: Object.assign({}, updateField(battery)),
                history: ((_b = (_a = user.targetAchieved) === null || _a === void 0 ? void 0 : _a.battery) === null || _b === void 0 ? void 0 : _b.history) || [],
            },
            eRickshaw: {
                total: eRickshaw.total,
                completed: eRickshaw.completed,
                pending: eRickshaw.total - Math.min(eRickshaw.completed, eRickshaw.total),
                extra: eRickshaw.completed > eRickshaw.total
                    ? eRickshaw.completed - eRickshaw.total
                    : 0,
                current: Object.assign({}, updateField(eRickshaw)),
                history: (_e = (_d = (_c = user.targetAchieved) === null || _c === void 0 ? void 0 : _c.eRickshaw) === null || _d === void 0 ? void 0 : _d.history) !== null && _e !== void 0 ? _e : [],
            },
            scooty: {
                total: scooty.total,
                completed: scooty.completed,
                pending: scooty.total - Math.min(scooty.completed, scooty.total),
                extra: scooty.completed > scooty.total ? scooty.completed - scooty.total : 0,
                current: Object.assign({}, updateField(scooty)),
                history: (_h = (_g = (_f = user.targetAchieved) === null || _f === void 0 ? void 0 : _f.scooty) === null || _g === void 0 ? void 0 : _g.history) !== null && _h !== void 0 ? _h : [],
            },
        };
        // If `month` is provided, push the current targets to history
        if (month && typeof month === "string") {
            const historyEntry = {
                month,
                total: updatedTargets.battery.current.total,
                completed: updatedTargets.battery.current.completed,
                pending: updatedTargets.battery.current.pending,
                extra: updatedTargets.battery.current.extra,
            };
            updatedTargets.battery.history.push(historyEntry);
            updatedTargets.eRickshaw.history.push(Object.assign(Object.assign({}, historyEntry), { total: updatedTargets.eRickshaw.current.total, completed: updatedTargets.eRickshaw.current.completed, pending: updatedTargets.eRickshaw.current.pending, extra: updatedTargets.eRickshaw.current.extra }));
            updatedTargets.scooty.history.push(Object.assign(Object.assign({}, historyEntry), { total: updatedTargets.scooty.current.total, completed: updatedTargets.scooty.current.completed, pending: updatedTargets.scooty.current.pending, extra: updatedTargets.scooty.current.extra }));
        }
        user.targetAchieved = updatedTargets;
        yield user.save();
        res.status(200).json({
            message: "Target updated successfully.",
            user,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "An error occurred while updating the target.",
            error,
        });
    }
});
exports.updateTarget = updateTarget;
const getTopEmployees = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const users = yield user_1.default.find();
        const calculatePercentage = (target) => {
            if (!target.total || target.total === 0)
                return 0;
            return (target.completed / target.total) * 100;
        };
        const employeesWithPercentage = users.map((user) => {
            var _a, _b, _c;
            const batteryPercentage = calculatePercentage(((_a = user.targetAchieved) === null || _a === void 0 ? void 0 : _a.battery) || {
                total: 0,
                completed: 0,
                pending: 0,
                extra: 0,
            });
            const eRickshawPercentage = calculatePercentage(((_b = user.targetAchieved) === null || _b === void 0 ? void 0 : _b.eRickshaw) || {
                total: 0,
                completed: 0,
                pending: 0,
                extra: 0,
            });
            const scootyPercentage = calculatePercentage(((_c = user.targetAchieved) === null || _c === void 0 ? void 0 : _c.scooty) || {
                total: 0,
                completed: 0,
                pending: 0,
                extra: 0,
            });
            const overallPercentage = (batteryPercentage + eRickshawPercentage + scootyPercentage) / 3;
            return {
                user,
                percentage: overallPercentage,
            };
        });
        const topEmployees = employeesWithPercentage
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 3)
            .map((item) => (Object.assign(Object.assign({}, item.user.toObject()), { percentage: item.percentage.toFixed(2) })));
        res.status(200).json({
            message: "Top 3 employees based on target achievement percentage",
            topEmployees,
        });
    }
    catch (error) {
        res.status(500).json({
            message: "An error occurred while fetching top employees.",
            error: error,
        });
    }
});
exports.getTopEmployees = getTopEmployees;
const getEmployeeDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const requestingUser = yield user_1.default.findById(req.userId);
        if (!requestingUser ||
            !["hr", "admin", "manager"].includes(requestingUser.role)) {
            return res
                .status(403)
                .json({ message: "Forbidden: Insufficient permissions" });
        }
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        const user = yield user_1.default.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (requestingUser.role === "hr" && user.role !== "employee") {
            return res
                .status(403)
                .json({ message: "HR can only view employee details" });
        }
        const visitors = yield visitor_1.default.find({ visitedBy: userId })
            .populate({
            path: "visitedBy",
            select: "name",
        })
            .exec();
        const visitorDetails = visitors.map((visitor) => ({
            clientName: visitor.clientName,
            clientPhoneNumber: visitor.clientPhoneNumber,
            clientAddress: visitor.clientAddress,
            visitDateTime: visitor.visitDateTime,
            purpose: visitor.purpose,
            feedback: visitor.feedback,
            addedBy: visitor.visitedBy.name,
        }));
        const leads = yield lead_1.default.find({ leadBy: userId })
            .sort({ leadDate: -1 })
            .select("-__v")
            .exec();
        const leadDetails = leads.map((lead) => ({
            id: lead._id,
            leadDate: lead.leadDate
                ? new Date(lead.leadDate).toISOString().split("T")[0]
                : null,
            callingDate: lead.callingDate
                ? new Date(lead.callingDate).toISOString().split("T")[0]
                : null,
            agentName: lead.agentName,
            customerName: lead.customerName,
            mobileNumber: lead.mobileNumber,
            occupation: lead.occupation,
            location: lead.location,
            town: lead.town,
            state: lead.state,
            status: lead.status,
            remark: lead.remark,
            interestedAndNotInterested: lead.interestedAndNotInterested,
            officeVisitRequired: lead.officeVisitRequired ? "Yes" : "No",
        }));
        const leadsSummary = {
            totalLeads: leads.length,
            interestedLeads: leads.filter((lead) => lead.interestedAndNotInterested.toLowerCase().includes("interested")).length,
            pendingLeads: leads.filter((lead) => lead.status.toLowerCase().includes("pending")).length,
            requiresVisit: leads.filter((lead) => lead.officeVisitRequired).length,
        };
        res.status(200).json({
            user,
            visitors: visitorDetails,
            leads: leadDetails,
            leadsSummary,
        });
    }
    catch (error) {
        if (error instanceof Error && error.name === "CastError") {
            return res.status(400).json({ message: "Invalid user ID format" });
        }
        res.status(500).json({ message: "Server error", error });
    }
});
exports.getEmployeeDetails = getEmployeeDetails;
const addVisitor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { clientName, clientPhoneNumber, clientAddress, visitDateTime, purpose, feedback, } = req.body;
        const user = yield user_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const newVisitor = new visitor_1.default({
            clientName,
            clientPhoneNumber,
            clientAddress,
            visitDateTime,
            purpose,
            feedback,
            visitedBy: userId,
        });
        const savedVisitor = yield newVisitor.save();
        user.visitors = user.visitors || [];
        user.visitors.push(savedVisitor._id);
        yield user.save();
        return res.status(201).json({
            message: "Visitor added successfully",
            visitor: savedVisitor,
        });
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error", error });
    }
});
exports.addVisitor = addVisitor;
// export const getVisitors = async (req: Request, res: Response) => {
//   try {
//     const userId = (req as any).userId;
//     const visitors = await Visitor.find({ visitedBy: userId })
//       .populate({
//         path: "visitedBy",
//         select: "name",
//       })
//       .exec();
//     const visitorDetails = visitors.map((visitor) => ({
//       clientName: visitor.clientName,
//       clientPhoneNumber: visitor.clientPhoneNumber,
//       clientAddress: visitor.clientAddress,
//       visitDateTime: visitor.visitDateTime,
//       purpose: visitor.purpose,
//       feedback: visitor.feedback,
//       addedBy: (visitor.visitedBy as any).name,
//     }));
//     res.status(200).json({ visitorDetails });
//   } catch (error) {
//     return res.status(500).json({ message: "Internal server error", error });
//   }
// };
const processExcelAndCreateLeads = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fileUrl, employeeId } = req.body;
        if (!fileUrl || !employeeId) {
            return res.status(400).json({
                success: false,
                message: "File URL and Employee ID are required",
            });
        }
        const userId = req.userId;
        const requester = yield user_1.default.findById(userId);
        if (!requester || !["hr", "admin", "manager"].includes(requester.role)) {
            return res.status(403).json({
                message: "Access denied. Only HR and admin can add target leads.",
            });
        }
        const response = yield axios_1.default.get(fileUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data);
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        if (data.length === 0) {
            return res
                .status(400)
                .json({ success: false, message: "Excel file is empty" });
        }
        const firstRow = data[0];
        const missingHeaders = Object.keys(healper_1.headerMapping).filter((header) => !(header in firstRow));
        if (missingHeaders.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid Excel format. Missing headers: " + missingHeaders.join(", "),
            });
        }
        const leads = [];
        const invalidRows = [];
        const errors = [];
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNumber = i + 2;
            if (!(0, healper_1.validateLeadData)(row)) {
                invalidRows.push({ row: rowNumber, reason: "Missing or invalid data" });
                continue;
            }
            try {
                const lead = (0, healper_1.convertRowToLead)(row, employeeId);
                lead.isTargetLead = true;
                leads.push(lead);
            }
            catch (error) {
                invalidRows.push({
                    row: rowNumber,
                    reason: error || "Invalid data format",
                });
                errors.push(`Row ${rowNumber}: ${error}`);
            }
        }
        if (leads.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid target leads found in the Excel file",
                invalidRows,
                errors,
            });
        }
        const session = yield lead_1.default.startSession();
        try {
            session.startTransaction();
            const savedLeads = yield lead_1.default.insertMany(leads, { session });
            yield user_1.default.findByIdAndUpdate(employeeId, { $push: { leads: { $each: savedLeads.map((lead) => lead._id) } } }, { session });
            const targetFileRecord = new targetLeadFile_1.default({
                fileUrl,
                uploadedBy: employeeId,
                leadCount: savedLeads.length,
                leads: savedLeads.map((lead) => lead._id),
            });
            yield targetFileRecord.save({ session });
            yield session.commitTransaction();
            return res.status(200).json({
                success: true,
                message: `Successfully processed ${leads.length} target leads`,
                totalRows: data.length,
                successfulRows: leads.length,
                invalidRows: invalidRows.length > 0 ? invalidRows : undefined,
                errors: errors.length > 0 ? errors : undefined,
                targetFileId: targetFileRecord._id,
            });
        }
        catch (error) {
            yield session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        console.error("Error processing Excel file:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing Excel file",
            error,
        });
    }
});
exports.processExcelAndCreateLeads = processExcelAndCreateLeads;
const createLeadsHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { fileUrl } = req.body;
        if (!fileUrl) {
            return res.status(400).json({
                success: false,
                message: "File URL is required",
            });
        }
        const userId = req.userId;
        const response = yield axios_1.default.get(fileUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data);
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        if (data.length === 0) {
            return res
                .status(400)
                .json({ success: false, message: "Excel file is empty" });
        }
        const leads = [];
        for (let row of data) {
            try {
                const lead = (0, healper_1.convertRowToLead)(row, userId);
                // isTargetLead defaults to false, no need to set explicitly
                leads.push(lead);
            }
            catch (error) {
                console.error("Invalid row data:", error);
            }
        }
        if (leads.length === 0) {
            return res
                .status(400)
                .json({ success: false, message: "No valid leads found" });
        }
        const session = yield lead_1.default.startSession();
        try {
            session.startTransaction();
            const savedLeads = yield lead_1.default.insertMany(leads, { session });
            yield user_1.default.findByIdAndUpdate(userId, { $push: { leads: { $each: savedLeads.map((lead) => lead._id) } } }, { session });
            const fileRecord = new leadFile_1.default({
                fileUrl,
                uploadedBy: userId,
                leadCount: savedLeads.length,
                leads: savedLeads.map((lead) => lead._id),
            });
            yield fileRecord.save({ session });
            yield session.commitTransaction();
            return res.status(200).json({
                success: true,
                message: `Successfully processed ${leads.length} leads`,
                fileId: fileRecord._id,
            });
        }
        catch (error) {
            yield session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        console.error("Error processing Excel file:", error);
        return res.status(500).json({
            success: false,
            message: "Error processing file",
            error,
        });
    }
});
exports.createLeadsHistory = createLeadsHistory;
const getFileUploadHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const paramId = req.params.id;
        const authUserId = req.userId;
        const userId = paramId ? paramId : authUserId;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: "User ID is required" });
        }
        const files = yield leadFile_1.default.find({ uploadedBy: userId })
            .sort({ uploadDate: -1 })
            .select("fileUrl uploadDate leadCount")
            .lean();
        return res.status(200).json({ success: true, files });
    }
    catch (error) {
        console.error("Error fetching file history:", error);
        return res
            .status(500)
            .json({ success: false, message: "Error fetching file history" });
    }
});
exports.getFileUploadHistory = getFileUploadHistory;
const getTargetFileUploadHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const paramId = req.params.id;
        const authUserId = req.userId;
        const userId = paramId ? paramId : authUserId;
        if (!userId) {
            return res
                .status(401)
                .json({ success: false, message: "User ID is required" });
        }
        const files = yield targetLeadFile_1.default.find({ uploadedBy: userId })
            .sort({ uploadDate: -1 })
            .select("fileUrl uploadDate leadCount")
            .lean();
        return res.status(200).json({ success: true, files });
    }
    catch (error) {
        console.error("Error fetching target file history:", error);
        return res
            .status(500)
            .json({ success: false, message: "Error fetching target file history" });
    }
});
exports.getTargetFileUploadHistory = getTargetFileUploadHistory;
const getLeads = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.userId;
        if (!mongoose_1.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID format",
            });
        }
        const user = yield user_1.default.findById(userId).populate({
            path: "leads",
            select: "-__v",
            options: {
                sort: { leadDate: -1 },
            },
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const formattedLeads = (_a = user === null || user === void 0 ? void 0 : user.leads) === null || _a === void 0 ? void 0 : _a.map((lead) => ({
            id: lead._id,
            leadDate: lead.leadDate
                ? new Date(lead.leadDate).toISOString().split("T")[0]
                : null,
            callingDate: lead.callingDate
                ? new Date(lead.callingDate).toISOString().split("T")[0]
                : null,
            agentName: lead.agentName,
            customerName: lead.customerName,
            mobileNumber: lead.mobileNumber,
            occupation: lead.occupation,
            location: lead.location,
            town: lead.town,
            state: lead.state,
            status: lead.status,
            remark: lead.remark,
            interestedAndNotInterested: lead.interestedAndNotInterested,
            officeVisitRequired: lead.officeVisitRequired ? "Yes" : "No",
        }));
        return res.status(200).json({
            success: true,
            count: formattedLeads ? formattedLeads.length : 0,
            leads: formattedLeads,
        });
    }
    catch (error) {
        console.error("Error fetching leads:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching leads",
            error: error,
        });
    }
});
exports.getLeads = getLeads;
const deleteRegularLeadFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fileId = req.params.fileId;
        const { requestId } = req.body;
        const id = req.userId;
        const authUserId = requestId ? requestId : id;
        if (!fileId) {
            return res
                .status(400)
                .json({ success: false, message: "File ID is required" });
        }
        if (!authUserId) {
            return res
                .status(401)
                .json({ success: false, message: "User ID is required" });
        }
        // Find the file and ensure it belongs to the user
        const file = yield leadFile_1.default.findOne({
            _id: fileId,
            uploadedBy: authUserId,
        });
        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found or you don’t have permission to delete it",
            });
        }
        const session = yield lead_1.default.startSession();
        try {
            session.startTransaction();
            // Optional: Delete associated leads (if you want to cascade delete)
            yield lead_1.default.deleteMany({ _id: { $in: file.leads } }, { session });
            // Remove lead references from the user's leads array
            yield user_1.default.updateOne({ _id: authUserId }, { $pull: { leads: { $in: file.leads } } }, { session });
            // Delete the file record
            yield leadFile_1.default.deleteOne({ _id: fileId }, { session });
            yield session.commitTransaction();
            return res.status(200).json({
                success: true,
                message: "Regular lead file deleted successfully",
            });
        }
        catch (error) {
            yield session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        console.error("Error deleting regular lead file:", error);
        return res
            .status(500)
            .json({ success: false, message: "Error deleting regular lead file" });
    }
});
exports.deleteRegularLeadFile = deleteRegularLeadFile;
const deleteTargetLeadFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const fileId = req.params.fileId;
        const { requestId } = req.body;
        const id = req.userId;
        const authUserId = requestId ? requestId : id;
        if (!fileId) {
            return res
                .status(400)
                .json({ success: false, message: "File ID is required" });
        }
        if (!authUserId) {
            return res
                .status(401)
                .json({ success: false, message: "User ID is required" });
        }
        // Find the file and ensure it belongs to the user
        const file = yield targetLeadFile_1.default.findOne({
            _id: fileId,
            uploadedBy: authUserId,
        });
        if (!file) {
            return res.status(404).json({
                success: false,
                message: "Target file not found or you don’t have permission to delete it",
            });
        }
        const session = yield lead_1.default.startSession();
        try {
            session.startTransaction();
            // Optional: Delete associated leads (if you want to cascade delete)
            yield lead_1.default.deleteMany({ _id: { $in: file.leads } }, { session });
            // Remove lead references from the user's leads array
            yield user_1.default.updateOne({ _id: authUserId }, { $pull: { leads: { $in: file.leads } } }, { session });
            // Delete the file record
            yield targetLeadFile_1.default.deleteOne({ _id: fileId }, { session });
            yield session.commitTransaction();
            return res.status(200).json({
                success: true,
                message: "Target lead file deleted successfully",
            });
        }
        catch (error) {
            yield session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    catch (error) {
        console.error("Error deleting target lead file:", error);
        return res
            .status(500)
            .json({ success: false, message: "Error deleting target lead file" });
    }
});
exports.deleteTargetLeadFile = deleteTargetLeadFile;
const getVisitors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = { visitedBy: userId };
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year = req.query.year ? parseInt(req.query.year) : null;
        if (month && year) {
            if (month >= 1 && month <= 12 && year >= 1900 && year <= 9999) {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 1);
                filter.visitDateTime = {
                    $gte: startDate,
                    $lt: endDate,
                };
            }
            else {
                res.status(400).json({
                    success: false,
                    message: "Invalid month or year",
                });
                return;
            }
        }
        const visitors = yield visitor_1.default.find(filter)
            .populate("visitedBy", "name")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        const total = yield visitor_1.default.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        res.status(200).json({
            success: true,
            data: visitors,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching visitors",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.getVisitors = getVisitors;
const getVisitorsOfEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = { visitedBy: id };
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year = req.query.year ? parseInt(req.query.year) : null;
        if (month && year) {
            if (month >= 1 && month <= 12 && year >= 1900 && year <= 9999) {
                const startDate = new Date(year, month - 1, 1);
                const endDate = new Date(year, month, 1);
                filter.visitDateTime = {
                    $gte: startDate,
                    $lt: endDate,
                };
            }
            else {
                res.status(400).json({
                    success: false,
                    message: "Invalid month or year",
                });
                return;
            }
        }
        const visitors = yield visitor_1.default.find(filter)
            .populate("visitedBy", "name")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        const total = yield visitor_1.default.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        res.status(200).json({
            success: true,
            data: visitors,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: total,
                itemsPerPage: limit,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching visitors",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.getVisitorsOfEmployee = getVisitorsOfEmployee;
const updateLastWorkingDate = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, lastWorkingDate } = req.body;
        const adminId = req.userId;
        const admin = yield user_1.default.findById(adminId);
        if (!admin) {
            return res
                .status(403)
                .json({ success: false, message: "Forbidden: User not found" });
        }
        if (!["hr", "admin", "manager"].includes(admin.role)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: Insufficient permissions",
            });
        }
        if (!userId || !lastWorkingDate) {
            return res.status(400).json({
                success: false,
                message: "User ID and last working date are required",
            });
        }
        const date = new Date(lastWorkingDate);
        if (isNaN(date.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format for last working date",
            });
        }
        const user = yield user_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        user.lastWorkingDate = date;
        yield user.save();
        return res.status(200).json({
            success: true,
            message: "Last working date updated successfully",
            data: {
                userId: user._id,
                lastWorkingDate: user.lastWorkingDate,
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating last working date",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.updateLastWorkingDate = updateLastWorkingDate;
