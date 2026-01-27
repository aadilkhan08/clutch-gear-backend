/**
 * Job Card Model
 * Detailed work tracking for vehicle service
 */
const mongoose = require("mongoose");

// Estimate item schema for cost breakdown
const estimateItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["service", "part", "labour", "consumable", "external"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

// Estimate schema for cost estimation & approval
const estimateSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["PENDING_APPROVAL", "APPROVED", "REJECTED"],
      default: "PENDING_APPROVAL",
    },
    items: [estimateItemSchema],
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountReason: {
      type: String,
      trim: true,
    },
    taxRate: {
      type: Number,
      default: 18,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    expiresAt: Date,
    notificationSentAt: Date,
  },
  { _id: true }
);

const jobItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["labour", "part", "consumable", "external"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedAt: Date,
  },
  { _id: true }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobNumber: {
      type: String,
      unique: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: [true, "Vehicle is required"],
    },
    vehicleSnapshot: {
      vehicleNumber: String,
      brand: String,
      model: String,
      year: Number,
      color: String,
    },
    odometerReading: {
      type: Number,
      min: 0,
    },
    fuelLevel: {
      type: String,
      enum: ["empty", "quarter", "half", "three-quarter", "full"],
    },
    customerComplaints: [String],
    diagnostics: {
      findings: [String],
      recommendations: [String],
      images: [
        {
          url: String,
          fileId: String,
          caption: String,
        },
      ],
    },
    assignedMechanics: [
      {
        name: String,
        mobile: String,
        specialization: String,
      },
    ],
    // Strict mechanic assignment for RBAC/workload tracking
    assignedMechanicUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    services: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    jobItems: [jobItemSchema],
    status: {
      type: String,
      enum: [
        "created", // Job card created
        "inspection", // Vehicle being inspected
        "awaiting-approval", // Waiting for customer approval
        "approved", // Customer approved cost
        "in-progress", // Work in progress
        "quality-check", // Quality check
        "ready", // Ready for delivery
        "delivered", // Vehicle delivered
        "cancelled", // Job cancelled
      ],
      default: "created",
    },
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        notes: String,
      },
    ],
    estimatedCompletion: Date,
    actualCompletion: Date,
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: Date,
    billing: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      discountReason: String,
      coupon: {
        code: String,
        couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
        discountType: String,
        discountValue: Number,
        discountAmount: Number,
      },
      taxRate: { type: Number, default: 18 },
      taxAmount: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
    },
    // Cost Estimate for customer approval
    estimate: estimateSchema,
    // Estimate history for tracking revisions
    estimateHistory: [estimateSchema],
    notes: {
      internal: String,
      customer: String,
    },
    images: {
      beforeService: [
        {
          url: String,
          fileId: String,
          caption: String,
        },
      ],
      afterService: [
        {
          url: String,
          fileId: String,
          caption: String,
        },
      ],
    },
    videos: {
      inspection: [
        {
          url: String,
          fileId: String,
          thumbnailUrl: String,
          caption: String,
          duration: Number, // seconds
        },
      ],
      repair: [
        {
          url: String,
          fileId: String,
          thumbnailUrl: String,
          caption: String,
          duration: Number,
        },
      ],
    },
    warranty: {
      hasWarranty: { type: Boolean, default: false },
      period: { value: Number, unit: String },
      terms: String,
      expiresAt: Date,
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

// Indexes (jobNumber index created by unique: true)
jobCardSchema.index({ customer: 1, status: 1 });
jobCardSchema.index({ vehicle: 1 });
jobCardSchema.index({ status: 1 });
jobCardSchema.index({ createdAt: -1 });
jobCardSchema.index({ "statusHistory.changedAt": -1 });
jobCardSchema.index({ assignedMechanicUserIds: 1, status: 1 });

/**
 * Generate job number before saving
 */
jobCardSchema.pre("save", async function (next) {
  if (!this.jobNumber) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const count = await mongoose.model("JobCard").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    this.jobNumber = `JOB${dateStr}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

/**
 * Calculate billing totals
 */
jobCardSchema.methods.calculateBilling = function () {
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const opts = arguments.length > 0 ? arguments[0] || {} : {};
  const onlyApproved = Boolean(opts.onlyApproved);

  const items = Array.isArray(this.jobItems) ? this.jobItems : [];
  const usedItems = onlyApproved
    ? items.filter((item) => item.isApproved)
    : items;

  const subtotal = usedItems.reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );
  const discount = Math.max(0, Number(this.billing.discount || 0));
  const afterDiscount = Math.max(0, subtotal - discount);
  const taxRate = Number.isFinite(Number(this.billing.taxRate))
    ? Number(this.billing.taxRate)
    : 0;
  const taxAmount = (afterDiscount * taxRate) / 100;
  const grandTotal = afterDiscount + taxAmount;

  this.billing.subtotal = round2(subtotal);
  this.billing.taxAmount = round2(Math.max(0, taxAmount));
  this.billing.grandTotal = round2(Math.max(0, grandTotal));

  return this.billing;
};

/**
 * Add status to history
 */
jobCardSchema.methods.updateStatus = async function (
  newStatus,
  userId,
  notes = ""
) {
  this.status = newStatus;

  // Keep lifecycle timestamps consistent
  if (newStatus === "ready" && !this.actualCompletion) {
    this.actualCompletion = new Date();
  }
  if (newStatus === "delivered") {
    if (!this.deliveredAt) this.deliveredAt = new Date();
    if (!this.actualCompletion) this.actualCompletion = new Date();
  }

  this.statusHistory.push({
    status: newStatus,
    changedAt: new Date(),
    changedBy: userId,
    notes,
  });
  await this.save();
};

/**
 * Get pending approval items
 */
jobCardSchema.virtual("pendingApprovalItems").get(function () {
  const items = Array.isArray(this.jobItems) ? this.jobItems : [];
  return items.filter((item) => !item.isApproved);
});

/**
 * Get approved items total
 */
jobCardSchema.virtual("approvedTotal").get(function () {
  const items = Array.isArray(this.jobItems) ? this.jobItems : [];
  return items
    .filter((item) => item.isApproved)
    .reduce((sum, item) => sum + item.total, 0);
});

jobCardSchema.set("toJSON", { virtuals: true });

const JobCard = mongoose.model("JobCard", jobCardSchema);

module.exports = JobCard;
