/**
 * Appointment Validators
 * Validation rules for appointment endpoints
 */
const { body } = require("express-validator");

const createAppointmentValidation = [
  body("vehicleId")
    .notEmpty()
    .withMessage("Vehicle is required")
    .isMongoId()
    .withMessage("Invalid vehicle ID"),
  body("services")
    .isArray({ min: 1 })
    .withMessage("At least one service is required"),
  body("services.*.serviceId")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID"),
  body("scheduledDate")
    .notEmpty()
    .withMessage("Scheduled date is required")
    .isISO8601()
    .withMessage("Invalid date format")
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new Error("Scheduled date cannot be in the past");
      }
      return true;
    }),
  body("timeSlot").notEmpty().withMessage("Time slot is required"),
  body("timeSlot.startTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Invalid start time format (HH:MM)"),
  body("timeSlot.endTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Invalid end time format (HH:MM)"),
  body("customerNotes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
  body("pickupRequired")
    .optional()
    .isBoolean()
    .withMessage("Pickup required must be a boolean"),
];

const updateAppointmentValidation = [
  body("scheduledDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),
  body("timeSlot.startTime")
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Invalid start time format (HH:MM)"),
  body("timeSlot.endTime")
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Invalid end time format (HH:MM)"),
  body("status")
    .optional()
    .isIn([
      "pending",
      "confirmed",
      "in-progress",
      "completed",
      "cancelled",
      "no-show",
    ])
    .withMessage("Invalid status"),
  body("adminNotes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const cancelAppointmentValidation = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
];

module.exports = {
  createAppointmentValidation,
  updateAppointmentValidation,
  cancelAppointmentValidation,
};
