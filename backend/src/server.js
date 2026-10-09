import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";


import userRoutes from "./routes/userRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import finalIARoutes from "./routes/finalIARoutes.js";
import finalAttendanceRoutes from "./routes/finalAttendanceRoutes.js";
import paperSettingRoutes from "./routes/paperSettingRoutes.js";



import connectDB from "./config/db.js";
dotenv.config();

const app = express();

// Correct client IPs behind Vercel / Nginx (used by audit log + rate limit)
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:3000",
  "https://local.exams.kptmangaluru.in",
  "https://exams.kptmangaluru.in",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
  })
);

app.use(clerkMiddleware());

// Make sure MongoDB is connected before any API route runs.
// If it is not reachable, reply with a clear error instead of crashing.
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: "Database is not reachable. Please try again in a moment." });
  }
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "KPT Attendance & IA API is running",
  });
});

const PORT = process.env.PORT || 5000;



app.use("/api/users", userRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/students", studentRoutes);
app.use(
  "/api/final-ia",
  finalIARoutes
);
app.use(
  "/api/final-attendance",
  finalAttendanceRoutes
);
app.use("/api/paper-setting", paperSettingRoutes);



// Local development only (Vercel does not use app.listen)
if (process.env.NODE_ENV !== "production") {
  connectDB()
    .catch(() => {})
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
      });
    });
}

export default app;