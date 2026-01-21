/**
 * Role Middleware
 * Role-based access control
 */
const ApiError = require("../utils/apiError");

/**
 * Check if user has required role
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Access denied. Required role: ${allowedRoles.join(" or ")}`
      );
    }

    next();
  };
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }

  if (req.user.role !== "admin") {
    throw ApiError.forbidden("Admin access required");
  }

  next();
};

/**
 * Check if user is regular user (customer)
 */
const isUser = (req, res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }

  if (req.user.role !== "user") {
    throw ApiError.forbidden("User access required");
  }

  next();
};

/**
 * Check if user is owner of resource or admin
 */
const isOwnerOrAdmin = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    // Admin/Super Admin can access anything
    if (req.user.role === "admin" || req.user.role === "superadmin") {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId =
      req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (
      resourceUserId &&
      resourceUserId.toString() !== req.user._id.toString()
    ) {
      throw ApiError.forbidden(
        "You do not have permission to access this resource"
      );
    }

    next();
  };
};

/**
 * Check if user is mechanic
 */
const isMechanic = (req, res, next) => {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }

  if (req.user.role !== "mechanic") {
    throw ApiError.forbidden("Mechanic access required");
  }

  next();
};

module.exports = {
  authorize,
  isAdmin,
  // Super Admin check
  isSuperAdmin: (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }
    if (req.user.role !== "superadmin") {
      throw ApiError.forbidden("Super Admin access required");
    }
    next();
  },
  isUser,
  isMechanic,
  isOwnerOrAdmin,
};
