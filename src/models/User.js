import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    openId: { type: String, unique: true, sparse: true },
    name: { type: String },
    email: { type: String, index: true },
    passwordHash: { type: String },
    isEmailVerified: { type: Boolean, default: false },
    loginMethod: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastSignedIn: { type: Date, default: Date.now },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
