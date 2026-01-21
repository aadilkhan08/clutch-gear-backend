/**
 * JobCard Validators
 * Validation rules for job card endpoints
 */
const { body } = require("express-validator");

const createJobCardValidation = [
  body("customerId")
    .notEmpty()
    .withMessage("Customer is required")
    .isMongoId()
    .withMessage("Invalid customer ID"),
  body("vehicleId")
    .notEmpty()
    .withMessage("Vehicle is required")
    .isMongoId()
    .withMessage("Invalid vehicle ID"),
  body("appointmentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid appointment ID"),
  body("odometerReading")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Odometer reading must be a positive number"),
  body("fuelLevel")
    .optional()
    .isIn(["empty", "quarter", "half", "three-quarter", "full"])
    .withMessage("Invalid fuel level"),
  body("customerComplaints")
    .optional()
    .isArray()
    .withMessage("Customer complaints must be an array"),
  body("mechanicUserIds")
    .optional()
    .isArray({ min: 1 })
    .withMessage("mechanicUserIds must be a non-empty array"),
  body("mechanicUserIds.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid mechanic user ID"),
];

const updateJobCardValidation = [
  body("status")
    .optional()
    .isIn([
      "created",
      "inspection",
      "awaiting-approval",
      "approved",
      "in-progress",
      "quality-check",
      "ready",
      "delivered",
      "cancelled",
    ])
    .withMessage("Invalid status"),
  body("odometerReading")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Odometer reading must be a positive number"),
  body("fuelLevel")
    .optional()
    .isIn(["empty", "quarter", "half", "three-quarter", "full"])
    .withMessage("Invalid fuel level"),
  body("estimatedCompletion")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),
];

const addJobItemValidation = [
  body("type")
    .notEmpty()
    .withMessage("Item type is required")
    .isIn(["labour", "part", "consumable", "external"])
    .withMessage("Invalid item type"),
  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("unitPrice")
    .notEmpty()
    .withMessage("Unit price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("discount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount must be a positive number"),
];

const approveItemsValidation = [
  body("itemIds")
    .isArray({ min: 1 })
    .withMessage("At least one item ID is required"),
  body("itemIds.*").isMongoId().withMessage("Invalid item ID"),
];

const updateBillingValidation = [
  body("discount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount must be a positive number"),
  body("discountReason")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Discount reason cannot exceed 200 characters"),
  body("taxRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Tax rate must be between 0 and 100"),
];

// Admin: assign mechanics by user IDs
const assignMechanicsValidation = [
  body("mechanicUserIds")
    .isArray({ min: 1 })
    .withMessage("mechanicUserIds must be a non-empty array"),
  body("mechanicUserIds.*").isMongoId().withMessage("Invalid mechanic user ID"),
];

// Mechanic: restricted status updates only
const mechanicUpdateStatusValidation = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["inspection", "in-progress", "quality-check", "ready"])
    .withMessage("Invalid status"),
  body("notes").optional().trim().isLength({ max: 500 }),
];

module.exports = {
  createJobCardValidation,
  updateJobCardValidation,
  addJobItemValidation,
  approveItemsValidation,
  updateBillingValidation,
  assignMechanicsValidation,
  mechanicUpdateStatusValidation,
};
