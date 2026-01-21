/**
 * Service Package Model
 * Subscription packages for services
 */
const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Package name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    type: {
      type: String,
      required: true,
      enum: ["service", "maintenance", "car-wash", "comprehensive"],
    },
    vehicleTypes: {
      type: [String],
      enum: ["car", "bike", "scooter", "auto", "truck", "bus", "all"],
      default: ["all"],
    },
    duration: {
      value: {
        type: Number,
        required: [true, "Duration value is required"],
      },
      unit: {
        type: String,
        enum: ["days", "months", "years"],
        default: "months",
      },
    },
    services: [
      {
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
        },
        maxUsage: {
          type: Number,
          default: -1, // -1 means unlimited
        },
        description: String,
      },
    ],
    features: [String], // Additional text features
    inclusions: [String],
    exclusions: [String],
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    originalPrice: {
      type: Number, // For showing discount
      min: [0, "Original price cannot be negative"],
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    taxRate: {
      type: Number,
      default: 18,
    },
    image: {
      url: String,
      fileId: String,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    termsAndConditions: String,
    validFrom: Date,
    validUntil: Date,
    maxSubscriptions: {
      type: Number,
      default: -1, // -1 means unlimited
    },
    currentSubscriptions: {
      type: Number,
      default: 0,
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
packageSchema.index({ type: 1 });
packageSchema.index({ vehicleTypes: 1 });
packageSchema.index({ isActive: 1 });
packageSchema.index({ isPopular: -1, displayOrder: 1 });

/**
 * Generate package code before saving
 */
packageSchema.pre("save", async function (next) {
  if (!this.code) {
    const typePrefix = this.type.substring(0, 3).toUpperCase();
    const count = await mongoose.model("Package").countDocuments();
    this.code = `PKG${typePrefix}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

/**
 * Check if package is available for subscription
 */
packageSchema.virtual("isAvailable").get(function () {
  if (!this.isActive) return false;
  if (this.validFrom && new Date() < this.validFrom) return false;
  if (this.validUntil && new Date() > this.validUntil) return false;
  if (
    this.maxSubscriptions !== -1 &&
    this.currentSubscriptions >= this.maxSubscriptions
  )
    return false;
  return true;
});

/**
 * Calculate savings
 */
packageSchema.virtual("savings").get(function () {
  if (!this.originalPrice) return 0;
  return this.originalPrice - this.price;
});

packageSchema.set("toJSON", { virtuals: true });

const Package = mongoose.model("Package", packageSchema);

module.exports = Package;
