/**
 * API Error Utility
 * Custom error class for API errors
 */

class ApiError extends Error {
  constructor(statusCode, message, errors = [], isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.isOperational = isOperational;
    this.success = false;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Bad Request (400)
   */
  static badRequest(message = "Bad request", errors = []) {
    return new ApiError(400, message, errors);
  }

  /**
   * Unauthorized (401)
   */
  static unauthorized(message = "Unauthorized access") {
    return new ApiError(401, message);
  }

  /**
   * Forbidden (403)
   */
  static forbidden(message = "Access forbidden") {
    return new ApiError(403, message);
  }

  /**
   * Not Found (404)
   */
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  /**
   * Conflict (409)
   */
  static conflict(message = "Resource already exists") {
    return new ApiError(409, message);
  }

  /**
   * Unprocessable Entity (422)
   */
  static unprocessable(message = "Validation failed", errors = []) {
    return new ApiError(422, message, errors);
  }

  /**
   * Too Many Requests (429)
   */
  static tooManyRequests(
    message = "Too many requests, please try again later"
  ) {
    return new ApiError(429, message);
  }

  /**
   * Internal Server Error (500)
   */
  static internal(message = "Internal server error") {
    return new ApiError(500, message, [], false);
  }

  /**
   * Service Unavailable (503)
   */
  static serviceUnavailable(message = "Service temporarily unavailable") {
    return new ApiError(503, message);
  }
}

module.exports = ApiError;
