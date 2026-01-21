/**
 * Garage Model
 * Workshop/Garage profile and settings
 */
const mongoose = require("mongoose");

const garageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Garage name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: [200, "Tagline cannot exceed 200 characters"],
    },
    logo: {
      url: String,
      fileId: String,
    },
    coverImage: {
      url: String,
      fileId: String,
    },
    images: [
      {
        url: String,
        fileId: String,
        caption: String,
      },
    ],
    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
      },
      landmark: String,
      city: {
        type: String,
        required: [true, "City is required"],
      },
      state: {
        type: String,
        required: [true, "State is required"],
      },
      pincode: {
        type: String,
        required: [true, "Pincode is required"],
        match: [/^\d{6}$/, "Please enter a valid 6-digit pincode"],
      },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    contact: {
      phone: {
        type: String,
        required: [true, "Phone number is required"],
      },
      alternatePhone: String,
      email: String,
      whatsapp: String,
    },
    social: {
      facebook: String,
      instagram: String,
      youtube: String,
      twitter: String,
      website: String,
      googleMaps: String,
    },
    servicesOffered: [String],
    businessHours: [
      {
        day: {
          type: Number,
          required: true,
          min: 0,
          max: 6, // 0 = Sunday, 6 = Saturday
        },
        isOpen: {
          type: Boolean,
          default: true,
        },
        openTime: String, // "09:00"
        closeTime: String, // "18:00"
        breakStart: String,
        breakEnd: String,
      },
    ],
    specialities: [
      {
        type: String,
        enum: [
          "car-service",
          "bike-service",
          "denting-painting",
          "ac-service",
          "electrical",
          "car-wash",
          "tyre-service",
          "oil-change",
          "wheel-alignment",
          "brake-service",
          "suspension",
          "engine-repair",
          "transmission",
          "custom-modification",
        ],
      },
    ],
    vehicleTypesServed: [
      {
        type: String,
        enum: ["car", "bike", "scooter", "auto", "truck", "bus"],
      },
    ],
    brandsServed: [String], // e.g., ['Maruti', 'Hyundai', 'Honda']
    certifications: [
      {
        name: String,
        issuedBy: String,
        validUntil: Date,
        image: {
          url: String,
          fileId: String,
        },
      },
    ],
    facilities: [
      {
        type: String,
        enum: [
          "waiting-area",
          "wifi",
          "refreshments",
          "parking",
          "pickup-drop",
          "loaner-vehicle",
          "ev-charging",
          "cctv",
          "digital-payment",
          "card-payment",
        ],
      },
    ],
    ratings: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
      distribution: {
        1: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        5: { type: Number, default: 0 },
      },
    },
    stats: {
      totalCustomers: { type: Number, default: 0 },
      totalVehiclesServiced: { type: Number, default: 0 },
      totalJobCards: { type: Number, default: 0 },
      yearsInBusiness: Number,
    },
    settings: {
      taxRegistration: {
        gstNumber: String,
        panNumber: String,
      },
      invoicePrefix: {
        type: String,
        default: "INV",
      },
      jobCardPrefix: {
        type: String,
        default: "JOB",
      },
      currency: {
        type: String,
        default: "INR",
      },
      timezone: {
        type: String,
        default: "Asia/Kolkata",
      },
      defaultTaxRate: {
        type: Number,
        default: 18,
      },
      appointmentSlotDuration: {
        type: Number,
        default: 30, // minutes
      },
      maxAppointmentsPerSlot: {
        type: Number,
        default: 3,
      },
      autoConfirmAppointments: {
        type: Boolean,
        default: false,
      },
      enableOnlinePayments: {
        type: Boolean,
        default: true,
      },
      sendSmsNotifications: {
        type: Boolean,
        default: true,
      },
      sendPushNotifications: {
        type: Boolean,
        default: true,
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    establishedYear: Number,
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
garageSchema.index({ "address.city": 1 });
garageSchema.index({ "address.pincode": 1 });
garageSchema.index({ "address.coordinates": "2dsphere" });
garageSchema.index({ specialities: 1 });
garageSchema.index({ vehicleTypesServed: 1 });
garageSchema.index({ "ratings.average": -1 });
garageSchema.index({ isActive: 1, isVerified: 1 });

/**
 * Generate slug before saving
 */
garageSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

/**
 * Check if garage is open now
 */
garageSchema.methods.isOpenNow = function () {
  const now = new Date();
  const day = now.getDay();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  const todayHours = this.businessHours.find((h) => h.day === day);

  if (!todayHours || !todayHours.isOpen) {
    return false;
  }

  if (time < todayHours.openTime || time > todayHours.closeTime) {
    return false;
  }

  // Check break time
  if (
    todayHours.breakStart &&
    todayHours.breakEnd &&
    time >= todayHours.breakStart &&
    time <= todayHours.breakEnd
  ) {
    return false;
  }

  return true;
};

/**
 * Get today's hours
 */
garageSchema.methods.getTodayHours = function () {
  const day = new Date().getDay();
  return this.businessHours.find((h) => h.day === day);
};

/**
 * Update ratings
 */
garageSchema.methods.updateRatings = async function (newRating) {
  const Review = mongoose.model("Review");
  const stats = await Review.aggregate([
    { $match: { garage: this._id } },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    this.ratings.average = Math.round(stats[0].average * 10) / 10;
    this.ratings.count = stats[0].count;
  }

  // Update distribution
  const distribution = await Review.aggregate([
    { $match: { garage: this._id } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  this.ratings.distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach((d) => {
    this.ratings.distribution[d._id] = d.count;
  });

  await this.save();
};

garageSchema.set("toJSON", { virtuals: true });

const Garage = mongoose.model("Garage", garageSchema);

module.exports = Garage;
