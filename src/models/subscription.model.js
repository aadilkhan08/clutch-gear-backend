/**
 * Subscription Model
 * Customer subscriptions to packages
 */
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    subscriptionNumber: {
      type: String,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: [true, "Package is required"],
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: [true, "Vehicle is required"],
    },
    // Snapshot of package at time of purchase
    packageSnapshot: {
      name: String,
      code: String,
      type: String,
      price: Number,
      duration: {
        value: Number,
        unit: String,
      },
      services: [
        {
          serviceId: mongoose.Schema.Types.ObjectId,
          serviceName: String,
          maxUsage: Number,
        },
      ],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    status: {
      type: String,
      enum: ["pending", "active", "expired", "cancelled", "paused"],
      default: "pending",
    },
    usage: [
      {
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
        },
        usedCount: {
          type: Number,
          default: 0,
        },
        maxAllowed: {
          type: Number,
          default: -1,
        },
        history: [
          {
            usedAt: Date,
            jobCard: { type: mongoose.Schema.Types.ObjectId, ref: "JobCard" },
            notes: String,
          },
        ],
      },
    ],
    payment: {
      amount: Number,
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
      paidAt: Date,
      method: String,
    },
    renewalHistory: [
      {
        renewedAt: Date,
        previousEndDate: Date,
        newEndDate: Date,
        paymentId: mongoose.Schema.Types.ObjectId,
      },
    ],
    pauseHistory: [
      {
        pausedAt: Date,
        resumedAt: Date,
        reason: String,
        pausedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    cancellation: {
      cancelledAt: Date,
      reason: String,
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      refundAmount: Number,
      refundStatus: String,
    },
    notes: String,
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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

// Indexes
subscriptionSchema.index({ customer: 1, status: 1 });
subscriptionSchema.index({ vehicle: 1 });
subscriptionSchema.index({ package: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });

/**
 * Generate subscription number before saving
 */
subscriptionSchema.pre("save", async function (next) {
  if (!this.subscriptionNumber) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;
    const count = await mongoose.model("Subscription").countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
    });
    this.subscriptionNumber = `SUB${dateStr}${String(count + 1).padStart(
      5,
      "0"
    )}`;
  }
  next();
});

/**
 * Check if subscription is active and valid
 */
subscriptionSchema.virtual("isValid").get(function () {
  return this.status === "active" && new Date() <= this.endDate;
});

/**
 * Days remaining
 */
subscriptionSchema.virtual("daysRemaining").get(function () {
  if (this.status !== "active") return 0;
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
});

/**
 * Check if a service can be used
 */
subscriptionSchema.methods.canUseService = function (serviceId) {
  if (!this.isValid)
    return { allowed: false, reason: "Subscription not active" };

  const serviceUsage = this.usage.find(
    (u) => u.service.toString() === serviceId.toString()
  );

  if (!serviceUsage) {
    return { allowed: false, reason: "Service not included in package" };
  }

  if (
    serviceUsage.maxAllowed !== -1 &&
    serviceUsage.usedCount >= serviceUsage.maxAllowed
  ) {
    return { allowed: false, reason: "Service usage limit reached" };
  }

  return {
    allowed: true,
    remaining:
      serviceUsage.maxAllowed === -1
        ? "unlimited"
        : serviceUsage.maxAllowed - serviceUsage.usedCount,
  };
};

/**
 * Record service usage
 */
subscriptionSchema.methods.recordUsage = async function (
  serviceId,
  jobCardId,
  notes = ""
) {
  const serviceUsage = this.usage.find(
    (u) => u.service.toString() === serviceId.toString()
  );

  if (!serviceUsage) {
    throw new Error("Service not found in subscription");
  }

  serviceUsage.usedCount += 1;
  serviceUsage.history.push({
    usedAt: new Date(),
    jobCard: jobCardId,
    notes,
  });

  await this.save();
  return this;
};

subscriptionSchema.set("toJSON", { virtuals: true });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

module.exports = Subscription;
