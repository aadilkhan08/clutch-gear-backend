/**
 * Washing Validators
 * Validation rules for washing module endpoints
 */
const { body, param, query } = require("express-validator");

/**
 * Zone Validators
 */
const createZoneValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Zone name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),
  body("code")
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage("Code must be at most 10 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
];

const updateZoneValidation = [
  param("id").isMongoId().withMessage("Invalid zone ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Zone name must be between 2 and 100 characters"),
  body("code")
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage("Code must be at most 10 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

/**
 * Area Validators
 */
const createAreaValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Area name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Area name must be between 2 and 100 characters"),
  body("zoneId")
    .notEmpty()
    .withMessage("Zone ID is required")
    .isMongoId()
    .withMessage("Invalid zone ID"),
  body("code")
    .optional()
    .trim()
    .isLength({ max: 15 })
    .withMessage("Code must be at most 15 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("pincode")
    .optional()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("Pincode must be 6 digits"),
  body("landmarks")
    .optional()
    .isArray()
    .withMessage("Landmarks must be an array"),
  body("landmarks.*")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Each landmark must be at most 100 characters"),
];

const updateAreaValidation = [
  param("id").isMongoId().withMessage("Invalid area ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Area name must be between 2 and 100 characters"),
  body("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  body("code")
    .optional()
    .trim()
    .isLength({ max: 15 })
    .withMessage("Code must be at most 15 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be at most 500 characters"),
  body("pincode")
    .optional()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("Pincode must be 6 digits"),
  body("landmarks")
    .optional()
    .isArray()
    .withMessage("Landmarks must be an array"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

/**
 * Wash Status Validators
 */
const markWashStatusValidation = [
  param("vehicleId").isMongoId().withMessage("Invalid vehicle ID"),
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "completed", "skipped", "holiday"])
    .withMessage(
      "Invalid status. Must be: pending, completed, skipped, or holiday"
    ),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO date"),
  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Remarks must be at most 500 characters"),
];

const bulkMarkStatusValidation = [
  body("vehicleIds")
    .isArray({ min: 1 })
    .withMessage("Vehicle IDs array is required with at least one ID"),
  body("vehicleIds.*")
    .isMongoId()
    .withMessage("All vehicle IDs must be valid MongoDB IDs"),
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "completed", "skipped", "holiday"])
    .withMessage("Invalid status"),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO date"),
  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Remarks must be at most 500 characters"),
];

const markHolidayValidation = [
  body("date")
    .notEmpty()
    .withMessage("Date is required")
    .isISO8601()
    .withMessage("Date must be a valid ISO date"),
  body("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  body("areaId").optional().isMongoId().withMessage("Invalid area ID"),
  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Remarks must be at most 500 characters"),
];

/**
 * Report Validators
 */
const dailyReportValidation = [
  query("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO date"),
  query("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  query("areaId").optional().isMongoId().withMessage("Invalid area ID"),
];

const monthlyReportValidation = [
  query("year")
    .optional()
    .isInt({ min: 2020, max: 2100 })
    .withMessage("Year must be between 2020 and 2100"),
  query("month")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Month must be between 1 and 12"),
  query("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  query("areaId").optional().isMongoId().withMessage("Invalid area ID"),
];

const exportReportValidation = [
  query("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Start date must be a valid ISO date"),
  query("endDate")
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("End date must be a valid ISO date"),
  query("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  query("areaId").optional().isMongoId().withMessage("Invalid area ID"),
  query("format")
    .optional()
    .isIn(["csv", "json"])
    .withMessage("Format must be csv or json"),
];

/**
 * Vehicle Assignment Validators
 */
const assignVehicleValidation = [
  param("vehicleId").isMongoId().withMessage("Invalid vehicle ID"),
  body("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  body("areaId").optional().isMongoId().withMessage("Invalid area ID"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
  body("planName")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Plan name must be at most 100 characters"),
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("startDate must be a valid ISO date"),
  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("endDate must be a valid ISO date"),
];

const initializeDailyWashValidation = [
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO date"),
  body("zoneId").optional().isMongoId().withMessage("Invalid zone ID"),
  body("areaId").optional().isMongoId().withMessage("Invalid area ID"),
];

module.exports = {
  createZoneValidation,
  updateZoneValidation,
  createAreaValidation,
  updateAreaValidation,
  markWashStatusValidation,
  bulkMarkStatusValidation,
  markHolidayValidation,
  dailyReportValidation,
  monthlyReportValidation,
  exportReportValidation,
  assignVehicleValidation,
  initializeDailyWashValidation,
};
