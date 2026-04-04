import express, { Request, Response, Application, NextFunction } from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import User from "./models/user";
import connectDB from "./config/db";
import { initSocket } from "./socket";
import imageRouter from "./routes/image";
import authRoutes from "./routes/auth";
import punchRoutes from "./routes/punch";
import locationRoutes from "./routes/location";
import taskRoutes from "./routes/task";
import leaveRoutes from "./routes/leave";
import reportRoutes from "./routes/report";
import breakRoutes from "./routes/break";
import alertRoutes from "./routes/alert";
import statsRoutes from "./routes/stats";
import adminRoutes from "./routes/admin";
import userRoutes from "./routes/user";
import attendanceRoutes from "./routes/attendance";
import geofenceRoutes from "./routes/geofence";
import performanceRoutes from "./routes/performance";
import anomalyRoutes from "./routes/anomaly";
import visitRoutes from "./routes/visit";
import heartbeatRoutes from "./routes/heartbeat";
import heatmapRoutes from "./routes/heatmap";
import notificationRoutes from "./routes/notification";
import morgan from "morgan";
import * as admin from "firebase-admin";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8000;

if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),   // crucial fix for newlines
    };

    // Optional: add more fields if you want (usually not needed)
    // privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('Firebase Admin SDK initialized from environment variables');
  } catch (err) {
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
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use("/api/images", imageRouter);
app.use("/api/auth", authRoutes);
app.use("/api/punch", punchRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/leaves", leaveRoutes); // Alias for Admin Panel
app.use("/api/report", reportRoutes);
app.use("/api/reports/export", reportRoutes); // Alias for Admin Panel bulk exports
app.use("/api/stock", taskRoutes); // Uses taskRoutes to fetch getStock
app.use("/api/break", breakRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/anomalies", anomalyRoutes); // Alias for Alert model criticals
app.use("/api/visits", visitRoutes);
app.use("/api/breaks", breakRoutes); // Alias for admin break listing
app.use("/api/heartbeat", heartbeatRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/heatmap", heatmapRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/geofence", geofenceRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Server");
});

const httpServer = createServer(app);
const io = initSocket(httpServer);

// Socket.io: JWT auth + room-based live tracking
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token as string;
    if (!token) return next(new Error("No token"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as any;
    const user = await User.findById(decoded.id).lean();
    if (!user) return next(new Error("User not found"));
    (socket as any).user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  const user = (socket as any).user;
  console.log(`Socket connected: ${user.name} (${user.role})`);

  // Admin/manager/hr joins a room to watch a specific user's live location
  socket.on("watch:user", (targetUserId: string) => {
    const canWatch =
      user.role === "admin" ||
      user.role === "hr" ||
      (user.role === "manager" &&
        (user._id.toString() === targetUserId ||
          user.manages?.some((m: any) => m.toString() === targetUserId))) ||
      (user.role === "employee" && user._id.toString() === targetUserId);

    if (!canWatch) {
      socket.emit("error", { message: "Access denied" });
      return;
    }
    socket.join(`location:${targetUserId}`);
  });

  socket.on("unwatch:user", (targetUserId: string) => {
    socket.leave(`location:${targetUserId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${user.name}`);
  });
});

const start = async () => {
  try {
    await connectDB();
    httpServer.listen(port, () =>
      console.log(`Server is connected to port : ${port}`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
