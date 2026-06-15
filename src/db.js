import mongoose from "mongoose";

const MONGODB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/amar_jeans";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGODB_URL);
    isConnected = true;
    console.log(`[MongoDB] Connected to ${MONGODB_URL}`);
  } catch (error) {
    console.error("[MongoDB] Connection failed:", error);
    throw error;
  }
}

export { mongoose };
