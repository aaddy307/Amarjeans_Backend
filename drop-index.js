import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb://localhost:27017/amar_jeans");
  try {
    await mongoose.connection.collection("orders").dropIndex("shopifyOrderId_1");
    console.log("Index dropped");
  } catch(e) {
    console.log("Error dropping index", e.message);
  }
  process.exit(0);
}
run();
