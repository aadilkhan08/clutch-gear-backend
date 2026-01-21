/**
 * Payment Model
 * Payment tracking for job cards
 */
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      unique: true,
    },
    jobCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCard",
      required: [true, "Job card is required"],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCard",
    },
    totalAmount: {
      type: Number,
      min: [0, "Total amount cannot be negative"],
    },
    paidAmount: {
      type: Number,
      min: [0, "Paid amount cannot be negative"],
      default: 0,
    },
    balanceAmount: {
      type: Number,
      min: [0, "Balance amount cannot be negative"],
      default: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["PARTIAL", "PAID", "REFUND_PENDING", "REFUNDED"],
      default: "PARTIAL",
    },
    transactions: [
      {
        transactionId: String,
        amount: {
          type: Number,
          min: [0, "Transaction amount cannot be negative"],
          required: true,
        },
        method: {
          type: String,
          enum: ["UPI", "CARD", "CASH", "RAZORPAY"],
          required: true,
        },
        paidAt: { type: Date, default: Date.now },
      },
    ],
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    paymentType: {
      type: String,
      enum: ["advance", "partial", "full", "refund"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi", "netbanking", "wallet", "cheque", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    transactionId: String,
    transactionDetails: {
      gateway: String,
      orderId: String,
      signature: String,
      bankReference: String,
    },
    checkout: {
      token: { type: String, index: true },
      expiresAt: Date,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: String,
    receiptUrl: {
      url: String,
      fileId: String,
    },
    refundDetails: {
      refundedAmount: Number,
      refundedAt: Date,
      reason: String,
      refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        if (ret.checkout && ret.checkout.token) {
          delete ret.checkout.token;
        }
        return ret;
      },
    },
  }
);

// Indexes (paymentNumber index created by unique: true)
paymentSchema.index({ jobCard: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentStatus: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ invoiceId: 1 });

/**
 * Generate payment number before saving
 */
paymentSchema.pre("save", async function (next) {
  if (!this.paymentNumber) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const count = await mongoose.model("Payment").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    this.paymentNumber = `PAY${dateStr}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

/**
 * Get total payments for a job card
 */
paymentSchema.statics.getJobCardPayments = async function (jobCardId) {
  const payments = await this.find({
    jobCard: jobCardId,
    status: "completed",
  });

  const totalPaid = payments.reduce((sum, p) => {
    if (p.paymentType === "refund") {
      return sum - p.amount;
    }
    return sum + p.amount;
  }, 0);

  return {
    payments,
    totalPaid,
    count: payments.length,
  };
};

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
