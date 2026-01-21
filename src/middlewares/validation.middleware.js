/**
 * Validation Middleware
 * Request validation using express-validator
 */
const { validationResult } = require("express-validator");
const ApiError = require("../utils/apiError");

/**
 * Handle validation errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    throw ApiError.unprocessable("Validation failed", errorMessages);
  }

  next();
};

/**
 * Validate MongoDB ObjectId in params
 */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const mongoose = require("mongoose");

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${paramName} format`);
    }

    next();
  };
};

/**
 * Sanitize request body
 * Remove any fields that are not in allowed list
 */
const sanitizeBody = (allowedFields) => {
  return (req, res, next) => {
    if (req.body && typeof req.body === "object") {
      const sanitized = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          sanitized[field] = req.body[field];
        }
      });
      req.body = sanitized;
    }
    next();
  };
};

module.exports = {
  validate,
  validateObjectId,
  sanitizeBody,
};
