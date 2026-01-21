/**
 * Car Wash Model
 * Daily car wash tracking for subscription customers
 */
const mongoose = require("mongoose");

const carWashSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: [true, "Vehicle is required"],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "skipped", "holiday", "cancelled"],
      default: "pending",
    },
    washType: {
      type: String,
      enum: ["exterior", "interior", "full", "quick"],
      default: "exterior",
    },
    washedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: Date,
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
    },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
    },
    // Legacy string fields for backward compatibility
    zoneName: {
      type: String,
      trim: true,
    },
    areaName: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      landmark: String,
      city: String,
      pincode: String,
    },
    preferredTime: {
      start: String,
      end: String,
    },
    actualTime: {
      start: Date,
      end: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    customerFeedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      submittedAt: Date,
    },
    images: {
      before: [
        {
          url: String,
          fileId: String,
        },
      ],
      after: [
        {
          url: String,
          fileId: String,
        },
      ],
    },
    skipReason: {
      type: String,
      enum: [
        "customer-request",
        "vehicle-not-available",
        "weather",
        "holiday",
        "other",
      ],
    },
    isBillable: {
      type: Boolean,
      default: false, // True only if not covered by subscription
    },
    charge: {
      amount: Number,
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
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
carWashSchema.index({ customer: 1, date: -1 });
carWashSchema.index({ subscription: 1 });
carWashSchema.index({ date: 1, status: 1 });
carWashSchema.index({ washedBy: 1, date: 1 });
carWashSchema.index({ zone: 1, date: 1 });
carWashSchema.index({ status: 1 });

// Compound unique index for one wash per vehicle per day
carWashSchema.index({ vehicle: 1, date: 1 }, { unique: true });

/**
 * Get wash duration in minutes
 */
carWashSchema.virtual("duration").get(function () {
  if (!this.actualTime?.start || !this.actualTime?.end) return null;
  return Math.round(
    (new Date(this.actualTime.end) - new Date(this.actualTime.start)) / 60000
  );
});

/**
 * Static: Get daily summary
 */
carWashSchema.statics.getDailySummary = async function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const summary = await this.aggregate([
    {
      $match: {
        date: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    completed: 0,
    pending: 0,
    skipped: 0,
    holiday: 0,
  };

  summary.forEach((s) => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return result;
};

/**
 * Static: Get zone-wise summary
 */
carWashSchema.statics.getZoneSummary = async function (date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        date: { $gte: startOfDay, $lte: endOfDay },
      },
    },
    {
      $group: {
        _id: { zone: "$zone", status: "$status" },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.zone",
        statuses: {
          $push: {
            status: "$_id.status",
            count: "$count",
          },
        },
        total: { $sum: "$count" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Static: Get monthly summary for a customer
 */
carWashSchema.statics.getCustomerMonthlySummary = async function (
  customerId,
  year,
  month
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        customer: new mongoose.Types.ObjectId(customerId),
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        dates: { $push: "$date" },
      },
    },
  ]);
};

carWashSchema.set("toJSON", { virtuals: true });

const CarWash = mongoose.model("CarWash", carWashSchema);

module.exports = CarWash;
