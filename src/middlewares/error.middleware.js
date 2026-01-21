/**
 * Error Handling Middleware
 * Centralized error handling
 */
const config = require("../config");
const ApiError = require("../utils/apiError");

/**
 * Convert non-ApiError to ApiError
 */
const errorConverter = (err, req, res, next) => {
  let error = err;

  // Normalize errors field early so downstream handlers can safely read it.
  const normalizeErrors = (value) => (Array.isArray(value) ? value : []);

  if (!(error instanceof ApiError)) {
    const statusCode = err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    const converted = new ApiError(
      statusCode,
      message,
      normalizeErrors(err?.errors),
      false
    );

    // Preserve the original stack so logs point to the real source.
    if (err?.stack) {
      converted.stack = err.stack;
    }
    // Keep a little extra debugging context (dev only output is handled in errorHandler)
    converted.originalName = err?.name;

    error = converted;
  } else {
    error.errors = normalizeErrors(error.errors);
  }

  next(error);
};

/**
 * Handle errors and send response
 */
const errorHandler = (err, req, res, next) => {
  let { statusCode, message, errors } = err;
  errors = Array.isArray(errors) ? errors : [];

  // Default to 500 if no status code
  statusCode = statusCode || 500;

  // Log error in development
  if (config.env === "development") {
    console.error("Error:", {
      statusCode,
      message,
      errors,
      stack: err.stack,
    });
  }

  // Log only essential info in production
  if (config.env === "production") {
    console.error(`[ERROR] ${statusCode} - ${message}`);

    // Don't leak internal errors in production
    if (statusCode === 500) {
      message = "Internal Server Error";
    }
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    ...(config.env === "development" && { stack: err.stack }),
  });
};

/**
 * Handle 404 - Route not found
 */
const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Handle MongoDB specific errors
 */
const mongoErrorHandler = (err, req, res, next) => {
  let error = err;

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = ApiError.conflict(`${field} already exists`);
  }

  // Validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.unprocessable("Validation failed", errors);
  }

  // Cast error (invalid ObjectId)
  if (err.name === "CastError") {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  next(error);
};

module.exports = {
  errorConverter,
  errorHandler,
  notFoundHandler,
  mongoErrorHandler,
};
