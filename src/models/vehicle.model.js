/**
 * Vehicle Model
 * Customer vehicles for service
 */
const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Vehicle owner is required"],
      index: true,
    },
    vehicleNumber: {
      type: String,
      required: [true, "Vehicle number is required"],
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/,
        "Please enter a valid Indian vehicle number",
      ],
    },
    vehicleType: {
      type: String,
      enum: ["car", "bike", "scooter", "auto", "truck", "bus", "other"],
      required: [true, "Vehicle type is required"],
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    model: {
      type: String,
      required: [true, "Model is required"],
      trim: true,
    },
    year: {
      type: Number,
      min: [1900, "Invalid year"],
      max: [new Date().getFullYear() + 1, "Invalid year"],
    },
    fuelType: {
      type: String,
      enum: ["petrol", "diesel", "cng", "electric", "hybrid"],
    },
    color: {
      type: String,
      trim: true,
    },
    engineNumber: {
      type: String,
      trim: true,
    },
    chassisNumber: {
      type: String,
      trim: true,
    },
    insuranceExpiry: Date,
    pucExpiry: Date,
    images: [
      {
        url: String,
        fileId: String,
        caption: String,
      },
    ],
    notes: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    washSubscription: {
      isActive: {
        type: Boolean,
        default: false,
      },
      planName: {
        type: String,
        trim: true,
      },
      startDate: Date,
      endDate: Date,
      notes: {
        type: String,
        trim: true,
      },
    },
    washZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
    },
    washArea: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
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

// Compound index for unique vehicle per owner
vehicleSchema.index({ owner: 1, vehicleNumber: 1 }, { unique: true });
vehicleSchema.index({ vehicleNumber: 1 });
vehicleSchema.index({ brand: 1, model: 1 });

/**
 * Get display name for vehicle
 */
vehicleSchema.virtual("displayName").get(function () {
  return `${this.brand} ${this.model} (${this.vehicleNumber})`;
});

/**
 * Check if insurance is expired
 */
vehicleSchema.virtual("isInsuranceExpired").get(function () {
  if (!this.insuranceExpiry) return null;
  return new Date() > this.insuranceExpiry;
});

/**
 * Check if PUC is expired
 */
vehicleSchema.virtual("isPucExpired").get(function () {
  if (!this.pucExpiry) return null;
  return new Date() > this.pucExpiry;
});

// Enable virtuals in JSON
vehicleSchema.set("toJSON", { virtuals: true });
vehicleSchema.set("toObject", { virtuals: true });

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

module.exports = Vehicle;
