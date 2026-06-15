import mongoose from "mongoose";

const otpCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    code: { type: String, required: true },
    type: { type: String, enum: ["register", "forgot_password"], required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const OtpCode = mongoose.model("OtpCode", otpCodeSchema);
