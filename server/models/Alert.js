const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "guest-user" }, // Can map to actual User ID later
    documentName: { type: String, required: true },
    documentType: { type: String, required: true },
    expiryDate: { type: Date, required: true },
    notificationSent: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    message: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Alert", AlertSchema);
