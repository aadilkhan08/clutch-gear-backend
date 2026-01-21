/**
 * Time Slot Model
 * Available booking slots for appointments
 */
const mongoose = require("mongoose");

const timeSlotSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0, // Sunday
      max: 6, // Saturday
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"],
    },
    maxBookings: {
      type: Number,
      default: 5,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index
timeSlotSchema.index({ dayOfWeek: 1, startTime: 1 }, { unique: true });
timeSlotSchema.index({ isActive: 1, dayOfWeek: 1 });

/**
 * Get day name
 */
timeSlotSchema.virtual("dayName").get(function () {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[this.dayOfWeek];
});

/**
 * Get display format
 */
timeSlotSchema.virtual("displaySlot").get(function () {
  return `${this.startTime} - ${this.endTime}`;
});

timeSlotSchema.set("toJSON", { virtuals: true });

const TimeSlot = mongoose.model("TimeSlot", timeSlotSchema);

module.exports = TimeSlot;
