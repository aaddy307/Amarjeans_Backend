import "dotenv/config";
import mongoose from "mongoose";

async function run() {
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error("MONGODB_URL is not set in .env");

  await mongoose.connect(url);
  try {
    await mongoose.connection.collection("orders").dropIndex("shopifyOrderId_1");
    console.log("Index dropped");
  } catch(e) {
    console.log("Error dropping index", e.message);
  }
  process.exit(0);
}
run();
