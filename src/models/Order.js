import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    orderNumber: { type: String },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    totalPrice: { type: String },
    currencyCode: { type: String, default: "INR" },
    customerEmail: { type: String },
    shippingAddress: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
