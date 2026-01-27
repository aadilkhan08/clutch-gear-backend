/**
 * OTP Model
 * Stores OTP for mobile verification
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const config = require("../config");

const otpSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["login", "register", "reset", "verify"],
      default: "login",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () =>
        new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups and automatic deletion
otpSchema.index({ mobile: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

/**
 * Check if OTP is valid
 */
otpSchema.methods.isValid = async function (inputOtp) {
  if (this.isUsed) return false;
  if (this.attempts >= config.otp.maxAttempts) return false;
  if (new Date() > this.expiresAt) return false;
  return bcrypt.compare(inputOtp, this.otpHash);
};

/**
 * Mark OTP as used
 */
otpSchema.methods.markAsUsed = async function () {
  this.isUsed = true;
  await this.save();
};

/**
 * Increment attempt count
 */
otpSchema.methods.incrementAttempts = async function () {
  this.attempts += 1;
  await this.save();
};

/**
 * Static: Generate new OTP
 */
otpSchema.statics.generateOTP = async function (mobile, purpose = "login") {
  // Invalidate any existing OTPs for this mobile and purpose
  await this.updateMany({ mobile, purpose, isUsed: false }, { isUsed: true });

  // Generate new OTP
  const otpLength = config.otp.length;
  const otp = Array.from({ length: otpLength }, () =>
    Math.floor(Math.random() * 10)
  ).join("");

  const otpHash = await bcrypt.hash(otp, 10);

  // Create new OTP document
  const otpDoc = await this.create({
    mobile,
    otpHash,
    purpose,
    expiresAt: new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000),
  });

  return { otpDoc, otp };
};

/**
 * Static: Verify OTP
 */
otpSchema.statics.verifyOTP = async function (mobile, otp, purpose = "login") {
  const otpDoc = await this.findOne({
    mobile,
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return { success: false, message: "OTP expired or not found" };
  }

  if (otpDoc.attempts >= config.otp.maxAttempts) {
    return { success: false, message: "Maximum attempts exceeded" };
  }

  const isMatch = await bcrypt.compare(otp, otpDoc.otpHash);
  if (!isMatch) {
    await otpDoc.incrementAttempts();
    const remaining = config.otp.maxAttempts - otpDoc.attempts;
    return {
      success: false,
      message: `Invalid OTP. ${remaining} attempts remaining`,
    };
  }

  await otpDoc.markAsUsed();
  return { success: true, message: "OTP verified successfully" };
};

const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;
