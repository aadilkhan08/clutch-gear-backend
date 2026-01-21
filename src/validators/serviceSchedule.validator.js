/**
 * Service Schedule Validators
 */
const { body, param, query } = require("express-validator");

const createScheduleValidation = [
  body("customerId").isMongoId().withMessage("Invalid customer ID"),
  body("vehicleId").isMongoId().withMessage("Invalid vehicle ID"),
  body("serviceType").trim().notEmpty().withMessage("Service type is required"),
  body("scheduleType")
    .isIn(["ONE_TIME", "PERIODIC"])
    .withMessage("Schedule type must be ONE_TIME or PERIODIC"),
  body("frequency")
    .if(body("scheduleType").equals("PERIODIC"))
    .notEmpty()
    .withMessage("Frequency is required for periodic schedules")
    .bail()
    .isIn(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"])
    .withMessage("Invalid frequency"),
  body("scheduledDate")
    .notEmpty()
    .withMessage("Scheduled date is required")
    .isISO8601()
    .withMessage("Scheduled date must be valid"),
  body("remarks")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Remarks too long"),
];

const updateScheduleValidation = [
  param("id").isMongoId().withMessage("Invalid schedule ID"),
  body("serviceType").optional().trim().isLength({ max: 200 }),
  body("scheduleType")
    .optional()
    .isIn(["ONE_TIME", "PERIODIC"])
    .withMessage("Schedule type must be ONE_TIME or PERIODIC"),
  body("frequency")
    .optional()
    .isIn(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"])
    .withMessage("Invalid frequency"),
  body("scheduledDate")
    .optional()
    .isISO8601()
    .withMessage("Scheduled date must be valid"),
  body("status")
    .optional()
    .isIn(["PENDING", "COMPLETED"])
    .withMessage("Invalid status"),
  body("remarks")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Remarks too long"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

const listScheduleValidation = [
  query("status").optional().isIn(["PENDING", "COMPLETED"]),
  query("scheduleType").optional().isIn(["ONE_TIME", "PERIODIC"]),
  query("frequency")
    .optional()
    .isIn(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  query("customerId").optional().isMongoId(),
  query("vehicleId").optional().isMongoId(),
  query("date").optional().isISO8601(),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
  query("type").optional().isIn(["today", "upcoming", "overdue"]),
];

const markCompletedValidation = [
  param("id").isMongoId().withMessage("Invalid schedule ID"),
  body("remarks")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Remarks too long"),
];

module.exports = {
  createScheduleValidation,
  updateScheduleValidation,
  listScheduleValidation,
  markCompletedValidation,
};
