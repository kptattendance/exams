import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";


import userRoutes from "./routes/userRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";

import connectDB from "./config/db.js";

dotenv.config();

const app = express();

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

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "KPT Attendance & IA API is running",
  });
});

const PORT = process.env.PORT || 5000;



app.use("/api/users", userRoutes);
app.use("/api/subjects", subjectRoutes);

connectDB().then(() => {
  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  }
});

export default app;