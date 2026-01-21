/**
 * Service Validators
 * Validation rules for service endpoints
 */
const { body } = require("express-validator");

const createServiceValidation = [
  body("name")
    .notEmpty()
    .withMessage("Service name is required")
    .trim()
    .isLength({ max: 200 })
    .withMessage("Name cannot exceed 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn([
      "general-service",
      "repair",
      "maintenance",
      "inspection",
      "bodywork",
      "electrical",
      "ac-service",
      "tyre-service",
      "oil-change",
      "washing",
      "custom",
    ])
    .withMessage("Invalid category"),
  body("vehicleTypes")
    .optional()
    .isArray()
    .withMessage("Vehicle types must be an array"),
  body("basePrice")
    .notEmpty()
    .withMessage("Base price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("estimatedDuration.value")
    .notEmpty()
    .withMessage("Duration value is required")
    .isFloat({ min: 0 })
    .withMessage("Duration must be a positive number"),
  body("estimatedDuration.unit")
    .optional()
    .isIn(["minutes", "hours", "days"])
    .withMessage("Invalid duration unit"),
];

const updateServiceValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Name cannot exceed 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("category")
    .optional()
    .isIn([
      "general-service",
      "repair",
      "maintenance",
      "inspection",
      "bodywork",
      "electrical",
      "ac-service",
      "tyre-service",
      "oil-change",
      "washing",
      "custom",
    ])
    .withMessage("Invalid category"),
  body("basePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("isPopular")
    .optional()
    .isBoolean()
    .withMessage("isPopular must be a boolean"),
];

module.exports = {
  createServiceValidation,
  updateServiceValidation,
};
