import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

export const connectDB = async (): Promise<void> => {
  try {
    if (!MONGO_URI) {
      console.error("MongoDB connection error: MONGO_URI is not defined in environment variables.");
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log("Database connected successfully to MongoDB");
  } catch (error: any) {
    console.error("Database connection failed:", error.message);
    setTimeout(connectDB, 5000);
  }
};
