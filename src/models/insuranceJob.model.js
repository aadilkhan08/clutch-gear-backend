/**
 * Insurance Job Model
 * Tracks insurance related job cards and documents
 */
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["RC", "POLICY", "SURVEY", "INVOICE"],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileId: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: true }
);

const insuranceJobSchema = new mongoose.Schema(
  {
    jobCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCard",
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    insuranceProvider: {
      type: String,
      required: true,
      trim: true,
    },
    policyNumber: {
      type: String,
      required: true,
      trim: true,
    },
    claimType: {
      type: String,
      enum: ["CASHLESS", "REIMBURSEMENT"],
      required: true,
    },
    claimStatus: {
      type: String,
      enum: [
        "INITIATED",
        "DOCUMENTS_UPLOADED",
        "SURVEY_DONE",
        "APPROVED",
        "REJECTED",
        "SETTLED",
      ],
      default: "INITIATED",
    },
    documents: [documentSchema],
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        remarks: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

insuranceJobSchema.index({ claimStatus: 1 });
insuranceJobSchema.index({ customerId: 1 });
insuranceJobSchema.index({ vehicleId: 1 });
insuranceJobSchema.index({ policyNumber: 1 });

const InsuranceJob = mongoose.model("InsuranceJob", insuranceJobSchema);

module.exports = InsuranceJob;
