/**
 * Helper Utilities
 * Common helper functions
 */

const config = require("../config");

/**
 * Generate random string
 */
const generateRandomString = (length = 10) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Parse pagination parameters
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(
    config.pagination.maxPageSize,
    Math.max(1, parseInt(query.limit, 10) || config.pagination.defaultPageSize)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Create pagination metadata
 */
const createPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Parse sort parameters
 */
const parseSort = (sortString, allowedFields = []) => {
  if (!sortString) return { createdAt: -1 };

  const sort = {};
  const parts = sortString.split(",");

  parts.forEach((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith("-")) {
      const field = trimmed.substring(1);
      if (allowedFields.length === 0 || allowedFields.includes(field)) {
        sort[field] = -1;
      }
    } else {
      if (allowedFields.length === 0 || allowedFields.includes(trimmed)) {
        sort[trimmed] = 1;
      }
    }
  });

  return Object.keys(sort).length > 0 ? sort : { createdAt: -1 };
};

/**
 * Parse filter parameters
 */
const parseFilters = (query, allowedFilters = []) => {
  const filters = {};

  allowedFilters.forEach((filter) => {
    if (query[filter] !== undefined && query[filter] !== "") {
      filters[filter] = query[filter];
    }
  });

  return filters;
};

/**
 * Sanitize object - remove undefined and null values
 */
const sanitizeObject = (obj) => {
  const sanitized = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      sanitized[key] = obj[key];
    }
  });
  return sanitized;
};

/**
 * Format mobile number (add country code if needed)
 */
const formatMobile = (mobile, countryCode = "91") => {
  const cleaned = mobile.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+${countryCode}${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith(countryCode)) {
    return `+${cleaned}`;
  }
  return mobile;
};

/**
 * Mask mobile number for display
 */
const maskMobile = (mobile) => {
  if (!mobile) return "";
  const cleaned = mobile.replace(/\D/g, "");
  if (cleaned.length >= 10) {
    return `XXXXXX${cleaned.slice(-4)}`;
  }
  return mobile;
};

/**
 * Calculate date range
 */
const getDateRange = (period) => {
  const now = new Date();
  let start;

  switch (period) {
    case "today":
      start = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      start = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      start = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "quarter":
      start = new Date(now.setMonth(now.getMonth() - 3));
      break;
    case "year":
      start = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default:
      start = new Date(0);
  }

  return { start, end: new Date() };
};

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check if value is valid MongoDB ObjectId
 */
const isValidObjectId = (id) => {
  const ObjectId = require("mongoose").Types.ObjectId;
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

module.exports = {
  generateRandomString,
  parsePagination,
  createPaginationMeta,
  parseSort,
  parseFilters,
  sanitizeObject,
  formatMobile,
  maskMobile,
  getDateRange,
  sleep,
  isValidObjectId,
};
