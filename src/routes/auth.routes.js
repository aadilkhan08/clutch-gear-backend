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
} = require("../middlewares");
const {
  sendOtpValidation,
  verifyOtpValidation,
  refreshTokenValidation,
} = require("../validators");

// Public routes
router.post(
  "/send-otp",
  sendOtpValidation,
  validate,
  authController.sendOTP
);
router.post(
  "/verify-otp",
  verifyOtpValidation,
  validate,
  authController.verifyOTP
);
router.post(
  "/resend-otp",
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
