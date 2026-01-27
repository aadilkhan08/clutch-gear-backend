/**
 * Auth Controller
 * Handles authentication operations
 */
const { User } = require("../models");
const config = require("../config");
const { otpService } = require("../services");
const { ApiResponse, ApiError, asyncHandler } = require("../utils");

/**
 * @desc    Send OTP to mobile number
 * @route   POST /api/v1/auth/send-otp
 * @access  Public
 */
const sendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  // Generate and send OTP
  const result = await otpService.generateAndSendOTP(mobile, "login");

  ApiResponse.success(res, result.message, {
    mobile,
    expiresAt: result.expiresAt,
    expiresInSeconds: Math.max(
      0,
      Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 1000)
    ),
    resendAfterSeconds: Math.max(1, config.otp.resendCooldownSeconds),
  });
});

/**
 * @desc    Verify OTP and login/register user
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
const verifyOTP = asyncHandler(async (req, res) => {
  const { mobile, otp, deviceInfo } = req.body;

  // Verify OTP
  const otpResult = await otpService.verifyOTP(mobile, otp, "login");

  if (!otpResult.success) {
    throw ApiError.badRequest(otpResult.message);
  }

  // Find or create user
  let user = await User.findOne({ mobile });
  let isNewUser = false;

  if (!user) {
    // Create new user
    user = await User.create({
      mobile,
      isVerified: true,
      deviceInfo,
    });
    isNewUser = true;
  } else {
    // Update existing user
    user.isVerified = true;
    user.lastLoginAt = new Date();
    if (deviceInfo) {
      user.deviceInfo = deviceInfo;
    }
    await user.save();
  }

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Save refresh token
  user.refreshToken = refreshToken;
  await user.save();

  ApiResponse.success(res, "Login successful", {
    user: user.toPublicProfile(),
    accessToken,
    refreshToken,
    isNewUser,
  });
});

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (with refresh token)
 */
const refreshToken = asyncHandler(async (req, res) => {
  const user = req.user; // Set by verifyRefreshToken middleware

  // Generate new tokens
  const accessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  // Update refresh token
  user.refreshToken = newRefreshToken;
  await user.save();

  ApiResponse.success(res, "Token refreshed successfully", {
    accessToken,
    refreshToken: newRefreshToken,
  });
});

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  // Clear refresh token
  await User.findByIdAndUpdate(req.userId, {
    refreshToken: null,
  });

  ApiResponse.success(res, "Logged out successfully");
});

/**
 * @desc    Get current user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  ApiResponse.success(
    res,
    "Profile fetched successfully",
    user.toPublicProfile()
  );
});

/**
 * @desc    Resend OTP
 * @route   POST /api/v1/auth/resend-otp
 * @access  Public
 */
const resendOTP = asyncHandler(async (req, res) => {
  const { mobile } = req.body;

  const result = await otpService.resendOTP(mobile, "login");

  ApiResponse.success(res, result.message, {
    mobile,
    expiresAt: result.expiresAt,
    expiresInSeconds: Math.max(
      0,
      Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 1000)
    ),
    resendAfterSeconds: Math.max(1, config.otp.resendCooldownSeconds),
  });
});

module.exports = {
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getMe,
  resendOTP,
};
