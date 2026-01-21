/**
 * Refund Request Model
 */
const mongoose = require("mongoose");

const refundRequestSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCard",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: [0, "Requested amount cannot be negative"],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "PROCESSED"],
      default: "PENDING",
      index: true,
    },
    adminRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    requestedAt: { type: Date, default: Date.now },
    processedAt: Date,
    logs: [
      {
        action: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        remarks: String,
      },
    ],
  },
  { timestamps: true }
);

refundRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("RefundRequest", refundRequestSchema);
