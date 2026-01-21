/**
 * Authentication Middleware
 * Verifies JWT tokens for protected routes
 */
const jwt = require("jsonwebtoken");
const config = require("../config");
const { User } = require("../models");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Authenticate user via JWT token
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // Check if token exists
  if (!token) {
    throw ApiError.unauthorized("Access denied. No token provided");
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Find user
    const user = await User.findById(decoded._id).select("-refreshToken");

    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    if (!user.isActive) {
      throw ApiError.forbidden("Your account has been deactivated");
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw ApiError.unauthorized("Token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw ApiError.unauthorized("Invalid token");
    }
    throw error;
  }
});

/**
 * Optional authentication
 * Attaches user if token present, but doesn't require it
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded._id).select("-refreshToken");

    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
      req.userRole = user.role;
    }
  } catch (error) {
    // Ignore token errors for optional auth
  }

  next();
});

/**
 * Verify refresh token
 */
const verifyRefreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw ApiError.badRequest("Refresh token is required");
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findById(decoded._id).select("+refreshToken");

    if (!user) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    if (user.refreshToken !== refreshToken) {
      throw ApiError.unauthorized("Refresh token mismatch");
    }

    if (!user.isActive) {
      throw ApiError.forbidden("Your account has been deactivated");
    }

    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw ApiError.unauthorized(
        "Refresh token has expired. Please login again"
      );
    }
    if (error.name === "JsonWebTokenError") {
      throw ApiError.unauthorized("Invalid refresh token");
    }
    throw error;
  }
});

module.exports = {
  authenticate,
  optionalAuth,
  verifyRefreshToken,
};
