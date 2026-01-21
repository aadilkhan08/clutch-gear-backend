/**
 * Service Schedule Model
 * Plans and tracks one-time and recurring service schedules
 */
const mongoose = require("mongoose");

const serviceScheduleSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    scheduleType: {
      type: String,
      enum: ["ONE_TIME", "PERIODIC"],
      required: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    nextServiceDate: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    history: [
      {
        date: Date,
        completedAt: Date,
        remarks: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

serviceScheduleSchema.index({ customerId: 1, vehicleId: 1 });

module.exports = mongoose.model("ServiceSchedule", serviceScheduleSchema);
