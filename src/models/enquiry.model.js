/**
 * Enquiry/Lead Model
 * Tracks potential customer enquiries and leads
 */
const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema(
  {
    // Lead Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Vehicle Information (optional)
    vehicleInfo: {
      vehicleNumber: { type: String, trim: true, uppercase: true },
      brand: { type: String, trim: true },
      model: { type: String, trim: true },
      vehicleType: {
        type: String,
        enum: ["2-wheeler", "4-wheeler", "other"],
      },
    },

    // Enquiry Details
    enquiryType: {
      type: String,
      enum: ["service", "repair", "inspection", "general", "callback", "other"],
      default: "general",
    },
    serviceInterest: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    // Source tracking
    source: {
      type: String,
      enum: [
        "walk-in",
        "phone",
        "website",
        "app",
        "referral",
        "social-media",
        "google",
        "other",
      ],
      default: "walk-in",
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Status tracking
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "interested",
        "not-interested",
        "follow-up",
        "converted",
        "closed",
      ],
      default: "new",
    },

    // Priority
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Follow-up
    nextFollowUp: {
      type: Date,
    },
    followUpHistory: [
      {
        date: { type: Date, default: Date.now },
        action: {
          type: String,
          enum: ["called", "messaged", "visited", "other"],
        },
        notes: { type: String },
        outcome: { type: String },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],

    // Conversion tracking
    convertedTo: {
      type: String,
      enum: ["customer", "appointment", "jobcard"],
    },
    convertedRefId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "convertedRefModel",
    },
    convertedRefModel: {
      type: String,
      enum: ["User", "Appointment", "JobCard"],
    },
    convertedAt: {
      type: Date,
    },

    // Additional notes
    notes: {
      type: String,
      trim: true,
    },

    // Who created/modified
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
enquirySchema.index({ status: 1, createdAt: -1 });
enquirySchema.index({ mobile: 1 });
enquirySchema.index({ assignedTo: 1, status: 1 });
enquirySchema.index({ nextFollowUp: 1, status: 1 });
enquirySchema.index({ source: 1 });
enquirySchema.index({ priority: 1 });

// Virtual for display name
enquirySchema.virtual("displayName").get(function () {
  return this.name || this.mobile;
});

// Method to add follow-up
enquirySchema.methods.addFollowUp = function (
  action,
  notes,
  outcome,
  createdBy
) {
  this.followUpHistory.push({
    date: new Date(),
    action,
    notes,
    outcome,
    createdBy,
  });
  return this.save();
};

// Method to convert lead
enquirySchema.methods.convertLead = function (
  convertedTo,
  refId,
  refModel,
  modifiedBy
) {
  this.status = "converted";
  this.convertedTo = convertedTo;
  this.convertedRefId = refId;
  this.convertedRefModel = refModel;
  this.convertedAt = new Date();
  this.lastModifiedBy = modifiedBy;
  return this.save();
};

// JSON transform
enquirySchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Enquiry", enquirySchema);
