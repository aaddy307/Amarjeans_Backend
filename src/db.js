import mongoose from "mongoose";
import { ENV } from "./_core/env.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(ENV.mongodbUrl);
    isConnected = true;
    console.log(`[MongoDB] Connected to ${ENV.mongodbUrl}`);
  } catch (error) {
    console.error("[MongoDB] Connection failed:", error);
    throw error;
  }
}

export { mongoose };
