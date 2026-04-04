"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = __importDefault(require("./models/user"));
const db_1 = __importDefault(require("./config/db"));
const socket_1 = require("./socket");
const image_1 = __importDefault(require("./routes/image"));
const auth_1 = __importDefault(require("./routes/auth"));
const punch_1 = __importDefault(require("./routes/punch"));
const location_1 = __importDefault(require("./routes/location"));
const task_1 = __importDefault(require("./routes/task"));
const leave_1 = __importDefault(require("./routes/leave"));
const report_1 = __importDefault(require("./routes/report"));
const break_1 = __importDefault(require("./routes/break"));
const alert_1 = __importDefault(require("./routes/alert"));
const stats_1 = __importDefault(require("./routes/stats"));
const admin_1 = __importDefault(require("./routes/admin"));
const user_2 = __importDefault(require("./routes/user"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const geofence_1 = __importDefault(require("./routes/geofence"));
const performance_1 = __importDefault(require("./routes/performance"));
const anomaly_1 = __importDefault(require("./routes/anomaly"));
const visit_1 = __importDefault(require("./routes/visit"));
const heartbeat_1 = __importDefault(require("./routes/heartbeat"));
const heatmap_1 = __importDefault(require("./routes/heatmap"));
const notification_1 = __importDefault(require("./routes/notification"));
const morgan_1 = __importDefault(require("morgan"));
const admin = __importStar(require("firebase-admin"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 8000;
if (!admin.apps.length) {
    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n'), // crucial fix for newlines
        };
        // Optional: add more fields if you want (usually not needed)
        // privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin SDK initialized from environment variables');
    }
    catch (err) {
        console.error('Failed to initialize Firebase Admin SDK:', err);
        // Optionally: throw err;  or just continue without notifications
    }
}
var corsOptions = {
    origin: [
        "http://localhost:3000",
        "https://test-frontend-iptp.vercel.app",
        "https://teststock.in",
        "https://www.teststock.in",
        "https://test-live-tracking-admin.vercel.app",
        "https://chilweeindia.com",
        "https://www.chilweeindia.com"
    ],
    credentials: true,
};
app.set("trust proxy", 1);
app.use((0, cors_1.default)(corsOptions));
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use(body_parser_1.default.json());
app.use((0, morgan_1.default)("dev"));
app.use((0, cookie_parser_1.default)());
app.use("/api/images", image_1.default);
app.use("/api/auth", auth_1.default);
app.use("/api/punch", punch_1.default);
app.use("/api/location", location_1.default);
app.use("/api/task", task_1.default);
app.use("/api/leave", leave_1.default);
app.use("/api/leaves", leave_1.default); // Alias for Admin Panel
app.use("/api/report", report_1.default);
app.use("/api/reports/export", report_1.default); // Alias for Admin Panel bulk exports
app.use("/api/stock", task_1.default); // Uses taskRoutes to fetch getStock
app.use("/api/break", break_1.default);
app.use("/api/alerts", alert_1.default);
app.use("/api/anomalies", anomaly_1.default); // Alias for Alert model criticals
app.use("/api/visits", visit_1.default);
app.use("/api/breaks", break_1.default); // Alias for admin break listing
app.use("/api/heartbeat", heartbeat_1.default);
app.use("/api/stats", stats_1.default);
app.use("/api/heatmap", heatmap_1.default);
app.use("/api/admin", admin_1.default);
app.use("/api/users", user_2.default);
app.use("/api/attendance", attendance_1.default);
app.use("/api/geofence", geofence_1.default);
app.use("/api/performance", performance_1.default);
app.use("/api/notifications", notification_1.default);
app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message });
});
app.get("/", (req, res) => {
    res.send("Welcome to the Server");
});
const httpServer = (0, http_1.createServer)(app);
const io = (0, socket_1.initSocket)(httpServer);
// Socket.io: JWT auth + room-based live tracking
io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token;
        if (!token)
            return next(new Error("No token"));
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "");
        const user = yield user_1.default.findById(decoded.id).lean();
        if (!user)
            return next(new Error("User not found"));
        socket.user = user;
        next();
    }
    catch (_b) {
        next(new Error("Invalid token"));
    }
}));
io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${user.name} (${user.role})`);
    // Admin/manager/hr joins a room to watch a specific user's live location
    socket.on("watch:user", (targetUserId) => {
        var _a;
        const canWatch = user.role === "admin" ||
            user.role === "hr" ||
            (user.role === "manager" &&
                (user._id.toString() === targetUserId ||
                    ((_a = user.manages) === null || _a === void 0 ? void 0 : _a.some((m) => m.toString() === targetUserId)))) ||
            (user.role === "employee" && user._id.toString() === targetUserId);
        if (!canWatch) {
            socket.emit("error", { message: "Access denied" });
            return;
        }
        socket.join(`location:${targetUserId}`);
    });
    socket.on("unwatch:user", (targetUserId) => {
        socket.leave(`location:${targetUserId}`);
    });
    socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${user.name}`);
    });
});
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        httpServer.listen(port, () => console.log(`Server is connected to port : ${port}`));
    }
    catch (error) {
        console.log(error);
    }
});
start();
