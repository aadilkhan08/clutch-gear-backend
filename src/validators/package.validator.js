/**
 * Package Validator
 * Validation rules for package operations
 */
const { body, query, param } = require("express-validator");

const createPackageValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Package name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),
  body("type")
    .notEmpty()
    .withMessage("Package type is required")
    .isIn(["service", "maintenance", "car-wash", "comprehensive"])
    .withMessage("Invalid package type"),
  body("duration.value")
    .notEmpty()
    .withMessage("Duration value is required")
    .isInt({ min: 1 })
    .withMessage("Duration must be at least 1"),
  body("duration.unit")
    .notEmpty()
    .withMessage("Duration unit is required")
    .isIn(["days", "months", "years"])
    .withMessage("Invalid duration unit"),
  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price cannot be negative"),
  body("services")
    .optional()
    .isArray()
    .withMessage("Services must be an array"),
  body("services.*.service")
    .optional()
    .isMongoId()
    .withMessage("Invalid service ID"),
  body("services.*.maxUsage")
    .optional()
    .isInt({ min: -1 })
    .withMessage("Max usage must be -1 (unlimited) or a positive number"),
  body("vehicleTypes")
    .optional()
    .isArray()
    .withMessage("Vehicle types must be an array"),
  body("vehicleTypes.*")
    .optional()
    .isIn(["car", "bike", "scooter", "auto", "truck", "bus", "all"])
    .withMessage("Invalid vehicle type"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("features")
    .optional()
    .isArray()
    .withMessage("Features must be an array"),
  body("inclusions")
    .optional()
    .isArray()
    .withMessage("Inclusions must be an array"),
  body("exclusions")
    .optional()
    .isArray()
    .withMessage("Exclusions must be an array"),
  body("originalPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Original price cannot be negative"),
  body("discountPercent")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Discount must be between 0 and 100"),
  body("taxRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Tax rate must be between 0 and 100"),
  body("isPopular")
    .optional()
    .isBoolean()
    .withMessage("isPopular must be boolean"),
  body("isRecommended")
    .optional()
    .isBoolean()
    .withMessage("isRecommended must be boolean"),
  body("displayOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Display order must be a non-negative integer"),
  body("validFrom")
    .optional()
    .isISO8601()
    .withMessage("Invalid valid from date"),
  body("validUntil")
    .optional()
    .isISO8601()
    .withMessage("Invalid valid until date"),
  body("maxSubscriptions")
    .optional()
    .isInt({ min: -1 })
    .withMessage(
      "Max subscriptions must be -1 (unlimited) or a positive number"
    ),
];

const updatePackageValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Package name cannot be empty")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),
  body("type")
    .optional()
    .isIn(["service", "maintenance", "car-wash", "comprehensive"])
    .withMessage("Invalid package type"),
  body("duration.value")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Duration must be at least 1"),
  body("duration.unit")
    .optional()
    .isIn(["days", "months", "years"])
    .withMessage("Invalid duration unit"),
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price cannot be negative"),
  body("services")
    .optional()
    .isArray()
    .withMessage("Services must be an array"),
  body("services.*.service")
    .optional()
    .isMongoId()
    .withMessage("Invalid service ID"),
  body("services.*.maxUsage")
    .optional()
    .isInt({ min: -1 })
    .withMessage("Max usage must be -1 (unlimited) or a positive number"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

module.exports = {
  createPackageValidation,
  updatePackageValidation,
};
