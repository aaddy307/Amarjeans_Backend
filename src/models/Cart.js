import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, default: 1 }
});

const cartSchema = new mongoose.Schema({
  items: [cartItemSchema],
}, { timestamps: true });

export const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
