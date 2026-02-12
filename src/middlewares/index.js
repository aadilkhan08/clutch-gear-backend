/**
 * Middlewares Index
 * Central export for all middlewares
 */
const {
  authenticate,
  optionalAuth,
  verifyRefreshToken,
} = require("./auth.middleware");
const {
  authorize,
  isAdmin,
  isSuperAdmin,
  isUser,
  isMechanic,
  isOwnerOrAdmin,
} = require("./role.middleware");
const {
  validate,
  validateObjectId,
  sanitizeBody,
} = require("./validation.middleware");
const {
  errorConverter,
  errorHandler,
  notFoundHandler,
  mongoErrorHandler,
} = require("./error.middleware");
module.exports = {
  // Auth
  authenticate,
  optionalAuth,
  verifyRefreshToken,

  // Role
  authorize,
  isAdmin,
  isSuperAdmin,
  isUser,
  isMechanic,
  isOwnerOrAdmin,

  // Validation
  validate,
  validateObjectId,
  sanitizeBody,

  // Error
  errorConverter,
  errorHandler,
  notFoundHandler,
  mongoErrorHandler,

};
