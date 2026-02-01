/**
 * Role Middleware
 * Role-based access control
 */
const ApiError = require("../utils/apiError");

/**
 * Normalize role names - "user" and "customer" are treated as equivalent
 * The actual role stored in DB is "user", but code may reference "customer"
 */
const normalizeRole = (role) => {
  if (role === "customer") return "user";
  return role;
};

/**
 * Check if user has required role
 * Note: "user" and "customer" are treated as the same role
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("Authentication required");
    }

    // Normalize allowed roles (convert "customer" to "user")
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    if (!normalizedAllowedRoles.includes(req.user.role)) {
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
