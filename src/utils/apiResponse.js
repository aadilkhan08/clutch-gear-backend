/**
 * API Response Utility
 * Standardized response format for all APIs
 */

class ApiResponse {
  constructor(statusCode, message, data = null, meta = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) this.meta = meta;
  }

  /**
   * Send response
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      message: this.message,
      data: this.data,
      ...(this.meta && { meta: this.meta }),
    });
  }

  /**
   * Success response (200)
   */
  static success(res, message = "Success", data = null, meta = null) {
    return new ApiResponse(200, message, data, meta).send(res);
  }

  /**
   * Created response (201)
   */
  static created(res, message = "Created successfully", data = null) {
    return new ApiResponse(201, message, data).send(res);
  }

  /**
   * No Content response (204)
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Paginated response
   */
  static paginated(res, message, data, pagination) {
    return new ApiResponse(200, message, data, { pagination }).send(res);
  }
}

module.exports = ApiResponse;
