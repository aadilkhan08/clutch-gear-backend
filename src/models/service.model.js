/**
 * Service Model
 * Services offered by the workshop
 */
const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "general-service",
        "repair",
        "maintenance",
        "inspection",
        "bodywork",
        "electrical",
        "ac-service",
        "tyre-service",
        "oil-change",
        "washing",
        "custom",
      ],
    },
    vehicleTypes: {
      type: [String],
      enum: ["car", "bike", "scooter", "auto", "truck", "bus", "other", "all"],
      default: ["all"],
    },
    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Price cannot be negative"],
    },
    taxPercentage: {
      type: Number,
      default: 18,
      min: [0, "Tax percentage cannot be negative"],
      max: [100, "Tax percentage cannot exceed 100"],
    },
    estimatedDuration: {
      value: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        enum: ["minutes", "hours", "days"],
        default: "hours",
      },
    },
    inclusions: [String],
    exclusions: [String],
    image: {
      url: String,
      fileId: String,
    },
    isPopular: {
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
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Indexes
serviceSchema.index({ category: 1 });
serviceSchema.index({ vehicleTypes: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ isPopular: -1, displayOrder: 1 });
serviceSchema.index({ name: "text", description: "text" });

/**
 * Get estimated duration in minutes
 */
serviceSchema.virtual("estimatedDurationMinutes").get(function () {
  const { value, unit } = this.estimatedDuration;
  switch (unit) {
    case "hours":
      return value * 60;
    case "days":
      return value * 24 * 60;
    default:
      return value;
  }
});

serviceSchema.set("toJSON", { virtuals: true });

const Service = mongoose.model("Service", serviceSchema);

module.exports = Service;
