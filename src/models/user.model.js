/**
 * User Model
 * Handles both Customer and Admin users
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        "Please enter a valid 10-digit Indian mobile number",
      ],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin", "mechanic"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      url: String,
      fileId: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    lastLoginAt: Date,
    deviceInfo: {
      deviceId: String,
      deviceType: String,
      fcmToken: String,
      fcmTokenUpdatedAt: Date,
    },
    // Notification preferences
    notificationPreferences: {
      pushEnabled: { type: Boolean, default: true },
      smsEnabled: { type: Boolean, default: true },
      remindersEnabled: { type: Boolean, default: true },
      // Granular controls
      bookingAlerts: { type: Boolean, default: true },
      statusUpdates: { type: Boolean, default: true },
      paymentAlerts: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        delete ret.refreshToken;
        return ret;
      },
    },
  }
);

// Indexes for faster queries (mobile and email indexes already created by unique/sparse)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

/**
 * Generate JWT Access Token
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      mobile: this.mobile,
      role: this.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

/**
 * Generate JWT Refresh Token
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

/**
 * Get public profile
 */
userSchema.methods.toPublicProfile = function () {
  return {
    _id: this._id,
    name: this.name,
    mobile: this.mobile,
    email: this.email,
    role: this.role,
    profileImage: this.profileImage?.url,
    address: this.address,
    isVerified: this.isVerified,
    isProfileComplete: this.isProfileComplete,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model("User", userSchema);

module.exports = User;
