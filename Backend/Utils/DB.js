import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const connectDB = async () => {
  try {
    const mon = await mongoose.connect(process.env.MONGOURI);
  } catch (error) {
    console.error("MongoDB connection error:", error);}
};
