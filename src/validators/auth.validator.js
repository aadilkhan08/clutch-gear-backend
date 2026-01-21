/**
 * Auth Validators
 * Validation rules for authentication endpoints
 */
const { body } = require("express-validator");

const sendOtpValidation = [
  body("mobile")
    .notEmpty()
    .withMessage("Mobile number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),
];

const verifyOtpValidation = [
  body("mobile")
    .notEmpty()
    .withMessage("Mobile number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
];

const refreshTokenValidation = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

module.exports = {
  sendOtpValidation,
  verifyOtpValidation,
  refreshTokenValidation,
};
