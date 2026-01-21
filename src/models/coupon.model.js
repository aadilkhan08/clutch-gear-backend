/**
 * Coupon Model
 * Discount codes and promotions
 */
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: [20, "Code cannot exceed 20 characters"],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    type: {
      type: String,
      required: true,
      enum: ["percentage", "flat", "free-service"],
    },
    value: {
      type: Number,
      required: [true, "Value is required"],
      min: [0, "Value cannot be negative"],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"],
    },
    maxDiscount: {
      type: Number,
      min: [0, "Maximum discount cannot be negative"],
    },
    validFrom: {
      type: Date,
      required: [true, "Valid from date is required"],
    },
    validUntil: {
      type: Date,
      required: [true, "Valid until date is required"],
    },
    usageLimit: {
      total: {
        type: Number,
        default: -1, // -1 means unlimited
      },
      perUser: {
        type: Number,
        default: 1,
      },
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    usageHistory: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        jobCard: { type: mongoose.Schema.Types.ObjectId, ref: "JobCard" },
        discountApplied: Number,
        usedAt: { type: Date, default: Date.now },
      },
    ],
    applicableTo: {
      services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
      categories: [String],
      vehicleTypes: [String],
      packages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Package" }],
    },
    restrictions: {
      newUsersOnly: { type: Boolean, default: false },
      firstOrderOnly: { type: Boolean, default: false },
      specificUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      excludeUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    freeService: {
      // For free-service type coupons
      service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
      serviceName: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: false, // If true, shows in app
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    terms: String,
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
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
couponSchema.index({ isPublic: 1 });
couponSchema.index({ "applicableTo.services": 1 });
couponSchema.index({ "applicableTo.categories": 1 });

/**
 * Check if coupon is valid
 */
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  if (!this.isActive) return false;
  if (now < this.validFrom || now > this.validUntil) return false;
  if (this.usageLimit.total !== -1 && this.usedCount >= this.usageLimit.total)
    return false;
  return true;
});

/**
 * Check if coupon can be used by a user
 */
couponSchema.methods.canBeUsedBy = async function (userId, orderAmount = 0) {
  // Basic validity check
  if (!this.isValid) {
    return { valid: false, reason: "Coupon is not valid or has expired" };
  }

  // Minimum order amount check
  if (orderAmount < this.minOrderAmount) {
    return {
      valid: false,
      reason: `Minimum order amount is ₹${this.minOrderAmount}`,
    };
  }

  // Check user restrictions
  if (this.restrictions.excludeUsers?.includes(userId)) {
    return {
      valid: false,
      reason: "This coupon is not valid for your account",
    };
  }

  if (
    this.restrictions.specificUsers?.length > 0 &&
    !this.restrictions.specificUsers.includes(userId)
  ) {
    return {
      valid: false,
      reason: "This coupon is not valid for your account",
    };
  }

  // Check per-user limit
  const userUsageCount = this.usageHistory.filter(
    (h) => h.user.toString() === userId.toString()
  ).length;

  if (userUsageCount >= this.usageLimit.perUser) {
    return { valid: false, reason: "You have already used this coupon" };
  }

  // Check new user / first order restrictions
  if (this.restrictions.newUsersOnly || this.restrictions.firstOrderOnly) {
    const User = mongoose.model("User");
    const JobCard = mongoose.model("JobCard");

    const user = await User.findById(userId);
    if (!user) {
      return { valid: false, reason: "User not found" };
    }

    if (this.restrictions.firstOrderOnly) {
      const previousOrders = await JobCard.countDocuments({
        customer: userId,
        status: "delivered",
      });
      if (previousOrders > 0) {
        return { valid: false, reason: "This coupon is for first order only" };
      }
    }
  }

  return { valid: true };
};

/**
 * Calculate discount amount
 */
couponSchema.methods.calculateDiscount = function (orderAmount) {
  if (!this.isValid) return 0;

  let discount = 0;

  if (this.type === "percentage") {
    discount = (orderAmount * this.value) / 100;
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else if (this.type === "flat") {
    discount = this.value;
  }

  // Discount cannot exceed order amount
  return Math.min(discount, orderAmount);
};

/**
 * Record coupon usage
 */
couponSchema.methods.recordUsage = async function (
  userId,
  jobCardId,
  discountApplied
) {
  this.usedCount += 1;
  this.usageHistory.push({
    user: userId,
    jobCard: jobCardId,
    discountApplied,
    usedAt: new Date(),
  });
  await this.save();
  return this;
};

couponSchema.set("toJSON", { virtuals: true });

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
