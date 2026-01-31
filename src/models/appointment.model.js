/**
 * Appointment Model
 * Service booking appointments
 */
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    appointmentNumber: {
      type: String,
      unique: true,
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
    services: [
      {
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
    },
    timeSlot: {
      startTime: {
        type: String,
        required: true,
      },
      endTime: {
        type: String,
        required: true,
      },
    },
    workshopSnapshot: {
      name: String,
      address: {
        street: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
      },
      phone: String,
    },
    status: {
      type: String,
      enum: [
        "pending", // Just booked
        "confirmed", // Admin confirmed
        "in-progress", // Work started
        "completed", // Work done
        "cancelled", // Cancelled by user/admin
        "no-show", // Customer didn't show up
      ],
      default: "pending",
    },
    customerNotes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    adminNotes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    estimatedCost: {
      type: Number,
      min: 0,
    },
    pickupRequired: {
      type: Boolean,
      default: false,
    },
    pickupFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    pickupAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    cancelledBy: {
      type: String,
      enum: ["customer", "admin"],
    },
    cancellationReason: String,
    cancelledAt: Date,
    confirmedAt: Date,
    completedAt: Date,
    rescheduleHistory: [
      {
        date: Date,
        timeSlot: {
          startTime: String,
          endTime: String,
        },
        rescheduledAt: Date,
        reason: String,
      },
    ],
    // Track which reminders have been sent
    reminders: {
      sent24h: {
        type: Boolean,
        default: false,
      },
      sent2h: {
        type: Boolean,
        default: false,
      },
      sentAt24h: Date,
      sentAt2h: Date,
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

// Indexes (appointmentNumber index created by unique: true)
appointmentSchema.index({ customer: 1, status: 1 });
appointmentSchema.index({ scheduledDate: 1, status: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ createdAt: -1 });

/**
 * Generate appointment number before saving
 */
appointmentSchema.pre("save", async function (next) {
  if (!this.appointmentNumber) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const count = await mongoose.model("Appointment").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    this.appointmentNumber = `APT${dateStr}${String(count + 1).padStart(
      4,
      "0",
    )}`;
  }
  next();
});

/**
 * Calculate total estimated cost
 */
appointmentSchema.virtual("totalEstimatedCost").get(function () {
  if (!this.services || this.services.length === 0) return 0;
  const servicesTotal = this.services.reduce(
    (sum, s) => sum + (s.price || 0),
    0,
  );
  return servicesTotal + (this.pickupFee || 0);
});

appointmentSchema.set("toJSON", { virtuals: true });

const Appointment = mongoose.model("Appointment", appointmentSchema);

module.exports = Appointment;
