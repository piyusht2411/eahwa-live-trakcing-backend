import express, { Request, Response, Application, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import connectDB from "./config/db";
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
    "https://eashwa-frontend-iptp.vercel.app",
    "https://eashwastock.in",
    "https://www.eashwastock.in"
  ],
  credentials: true,
};

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
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/geofence", geofenceRoutes);
app.use("/api/performance", performanceRoutes);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ message: err.message });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to the Server");
});

const start = async () => {
  try {
    await connectDB();
    app.listen(port, () =>
      console.log(`Server is connected to port : ${port}`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();
