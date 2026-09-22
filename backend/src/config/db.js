import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // modern options, mongoose >= 8 handles most automatically
      dbName: process.env.MONGO_DB_NAME || "kptia",
    });

    console.log(`✅ MongoDB connected.....: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection error........:", error.message);
    process.exit(1);
  }
};

export default connectDB;
