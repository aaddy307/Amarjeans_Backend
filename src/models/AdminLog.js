import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    details: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AdminLog = mongoose.model("AdminLog", adminLogSchema);
