/**
 * Auth Routes
 */
const express = require("express");
const router = express.Router();
const { authController } = require("../controllers");
const {
  authenticate,
  verifyRefreshToken,
  validate,
  otpLimiter,
  authLimiter,
} = require("../middlewares");
const {
  sendOtpValidation,
  verifyOtpValidation,
  refreshTokenValidation,
} = require("../validators");

// Public routes
router.post(
  "/send-otp",
  otpLimiter,
  sendOtpValidation,
  validate,
  authController.sendOTP
);
router.post(
  "/verify-otp",
  authLimiter,
  verifyOtpValidation,
  validate,
  authController.verifyOTP
);
router.post(
  "/resend-otp",
  otpLimiter,
  sendOtpValidation,
  validate,
  authController.resendOTP
);
router.post(
  "/refresh-token",
  refreshTokenValidation,
  validate,
  verifyRefreshToken,
  authController.refreshToken
);

// Protected routes
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getMe);

module.exports = router;
