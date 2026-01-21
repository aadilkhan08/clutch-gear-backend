/**
 * OTP Service
 * Handles OTP generation and verification
 */
const { OTP } = require("../models");
const smsService = require("./sms.service");

/**
 * Generate and send OTP
 */
const generateAndSendOTP = async (mobile, purpose = "login") => {
  // Generate OTP
  const otpDoc = await OTP.generateOTP(mobile, purpose);

  // Send OTP via SMS
  await smsService.sendOTP(mobile, otpDoc.otp);

  return {
    success: true,
    message: `OTP sent to ${mobile.slice(-4).padStart(mobile.length, "X")}`,
    expiresAt: otpDoc.expiresAt,
  };
};

/**
 * Verify OTP
 */
const verifyOTP = async (mobile, otp, purpose = "login") => {
  const result = await OTP.verifyOTP(mobile, otp, purpose);
  return result;
};

/**
 * Resend OTP
 */
const resendOTP = async (mobile, purpose = "login") => {
  return await generateAndSendOTP(mobile, purpose);
};

module.exports = {
  generateAndSendOTP,
  verifyOTP,
  resendOTP,
};
