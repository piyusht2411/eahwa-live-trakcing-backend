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
exports.login = exports.changePassword = exports.updateFcmToken = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const user_1 = __importDefault(require("../models/user"));
const performance_1 = __importDefault(require("../models/performance"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.register = [
    upload.single("profilePicture"), // ← multer middleware (optional field)
    (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { name, email, password, role, department, phone, managerId, aadhaarNumber, address, employeeId, post, homeLat, homeLng, homeAddress, mapColor, employeeType } = req.body;
        let profilePicture = "";
        try {
            // === Upload profile picture to Cloudinary (if file sent) ===
            if (req.file) {
                const result = yield new Promise((resolve, reject) => {
                    cloudinary_1.default.uploader.upload_stream({ resource_type: "auto" }, (error, result) => {
                        if (error)
                            reject(error);
                        else
                            resolve(result);
                    }).end(req.file.buffer);
                });
                profilePicture = result.secure_url;
            }
            const existingUser = yield user_1.default.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: "User exists" });
            }
            const homeLocation = {};
            if (homeLat != null) {
                const latNum = parseFloat(homeLat);
                if (!isNaN(latNum))
                    homeLocation.lat = latNum;
            }
            if (homeLng != null) {
                const lngNum = parseFloat(homeLng);
                if (!isNaN(lngNum))
                    homeLocation.lng = lngNum;
            }
            if (homeAddress != null) {
                homeLocation.address = homeAddress;
            }
            // Roles that are treated as employees (get employeeId, can have leaves/attendance)
            const employeeRoles = ["manager", "super_manager", "hr", "employee"];
            const user = new user_1.default(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ name,
                email,
                password,
                role,
                department,
                phone,
                profilePicture }, (aadhaarNumber && { aadhaarNumber })), (address && { address })), (employeeId && { employeeId })), (post && { post })), (managerId && { managedBy: managerId })), (Object.keys(homeLocation).length > 0 && { homeLocation })), (mapColor && { mapColor })), (employeeRoles.includes(role) && employeeType && { employeeType })));
            yield user.save();
            // Auto-generate employeeId for all employee-type roles
            if (employeeRoles.includes(role) && !user.employeeId) {
                user.employeeId = `EMP${Date.now()}`;
                yield user.save();
            }
            const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET || "", {
                expiresIn: "30d",
            });
            res.status(201).json({
                token,
                user: {
                    id: user._id,
                    name,
                    email,
                    role,
                    employeeType: (_a = user.employeeType) !== null && _a !== void 0 ? _a : null,
                    activeMode: (_b = user.activeMode) !== null && _b !== void 0 ? _b : null,
                    department,
                    phone,
                    profilePicture,
                    managerId,
                    aadhaarNumber,
                    address,
                    employeeId: user.employeeId,
                    post,
                    homeLocation: user.homeLocation || null,
                },
            });
        }
        catch (error) {
            console.log("Register error:", error);
            res.status(500).json({ message: "Server error" });
        }
    }),
];
const updateFcmToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== "string") {
        return res.status(400).json({ message: "fcmToken required" });
    }
    yield user_1.default.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ success: true });
});
exports.updateFcmToken = updateFcmToken;
const changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ message: "email and newPassword are required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ message: "newPassword must be at least 6 characters" });
    }
    try {
        const user = yield user_1.default.findOne({ email }).select("+password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        user.password = newPassword;
        yield user.save(); // pre-save hook in User model auto-hashes the password
        return res.status(200).json({ success: true, message: "Password changed successfully" });
    }
    catch (error) {
        console.error("changePassword error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});
exports.changePassword = changePassword;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { userName, password, fcmToken } = req.body;
    try {
        const user = yield user_1.default.findOne({
            $or: [{ email: userName }, { employeeId: userName }],
        }).select("+password").populate("managedBy", "name");
        if (!user || !(yield bcrypt_1.default.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        let needsSave = false;
        if (fcmToken && typeof fcmToken === "string" && fcmToken.length > 10 && fcmToken.length < 200) {
            user.fcmToken = fcmToken;
            needsSave = true;
        }
        if (!user.mapColor) {
            const MAP_COLORS = [
                "#E63946", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
                "#00BCD4", "#F44336", "#3F51B5", "#8BC34A", "#FF5722",
                "#607D8B", "#E91E63", "#009688", "#FFC107", "#673AB7",
                "#03A9F4", "#CDDC39", "#FF4081", "#00ACC1", "#7B1FA2",
            ];
            // Pick based on user creation time to spread colors across users
            const index = Math.abs(String(user._id).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % MAP_COLORS.length;
            user.mapColor = MAP_COLORS[index];
            needsSave = true;
        }
        if (needsSave) {
            yield user.save({ validateBeforeSave: false });
        }
        const token = jsonwebtoken_1.default.sign({ id: user._id }, process.env.JWT_SECRET || "", {
            expiresIn: "30d",
        });
        const manager = user.managedBy;
        // Fetch today's performance score and rank
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayPerf = yield performance_1.default.findOne({
            user: user._id,
            period: "daily",
            periodStart: { $gte: todayStart },
        }).sort({ periodStart: -1 });
        let score = (_a = todayPerf === null || todayPerf === void 0 ? void 0 : todayPerf.score) !== null && _a !== void 0 ? _a : null;
        let rank = null;
        if (score !== null) {
            // Rank = how many employees scored strictly higher + 1
            const higherCount = yield performance_1.default.countDocuments({
                period: "daily",
                periodStart: { $gte: todayStart },
                score: { $gt: score },
            });
            rank = higherCount + 1;
        }
        res.status(200).json({
            ok: true,
            message: "User login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                employeeType: (_b = user.employeeType) !== null && _b !== void 0 ? _b : null,
                activeMode: (_c = user.activeMode) !== null && _c !== void 0 ? _c : null,
                profilePicture: user.profilePicture || "",
                department: user.department,
                phone: user.phone,
                aadhaarNumber: user.aadhaarNumber,
                address: user.address,
                employeeId: user.employeeId,
                post: user.post,
                managedBy: manager ? { id: manager._id, name: manager.name } : null,
                joiningDate: user.joiningDate,
                score,
                rank,
                homeLocation: user.homeLocation || null,
                mapColor: user.mapColor,
            },
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again later.",
        });
    }
});
exports.login = login;
