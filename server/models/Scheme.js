const mongoose = require("mongoose");

const schemeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nameHindi: { type: String },
    nameKannada: { type: String },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["agriculture", "housing", "health", "education", "finance", "welfare"],
    },
    eligibility: {
      ageMin: { type: Number, default: 0 },
      ageMax: { type: Number, default: 120 },
      incomeMax: { type: Number, default: Infinity },
      occupations: [String],
    },
    benefits: { type: String },
    applicationFee: { type: Number, default: 0 },
    applicationUrl: { type: String },
    verifiedSource: { type: String },
    nearestCenter: { type: String },
    nextSteps: [String],
    isActive: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Scheme", schemeSchema);
