/**
 * Enquiry Validator
 * Validation rules for enquiry operations
 */
const { body } = require("express-validator");

const createEnquiryValidation = [
  body("name")
    .notEmpty()
    .withMessage("Name is required")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("mobile")
    .notEmpty()
    .withMessage("Mobile number is required")
    .customSanitizer((value) => {
      const digits = String(value || "").replace(/\D/g, "");
      return digits.length > 10 ? digits.slice(-10) : digits;
    })
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please provide a valid 10-digit mobile number"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email"),

  body("vehicleInfo.vehicleNumber")
    .optional()
    .trim()
    .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/)
    .withMessage("Invalid vehicle number format"),

  body("vehicleInfo.vehicleType")
    .optional()
    .isIn(["2-wheeler", "4-wheeler", "other"])
    .withMessage("Invalid vehicle type"),

  body("enquiryType")
    .optional()
    .isIn(["service", "repair", "inspection", "general", "callback", "other"])
    .withMessage("Invalid enquiry type"),

  body("source")
    .optional()
    .isIn([
      "walk-in",
      "phone",
      "website",
      "app",
      "referral",
      "social-media",
      "google",
      "other",
    ])
    .withMessage("Invalid source"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  body("serviceInterest")
    .optional()
    .isArray()
    .withMessage("Service interest must be an array"),

  body("serviceInterest.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid service ID"),

  body("nextFollowUp")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for next follow-up"),
];

const updateEnquiryValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("status")
    .optional()
    .isIn([
      "new",
      "contacted",
      "interested",
      "not-interested",
      "follow-up",
      "converted",
      "closed",
    ])
    .withMessage("Invalid status"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),

  body("assignedTo").optional().isMongoId().withMessage("Invalid assignee ID"),

  body("nextFollowUp")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),
];

const addFollowUpValidation = [
  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["called", "messaged", "visited", "other"])
    .withMessage("Invalid action type"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),

  body("outcome")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Outcome must not exceed 200 characters"),

  body("nextFollowUp")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),
];

const assignEnquiryValidation = [
  body("assignedTo")
    .notEmpty()
    .withMessage("Assignee is required")
    .isMongoId()
    .withMessage("Invalid assignee ID"),
];

const convertEnquiryValidation = [
  body("convertTo")
    .notEmpty()
    .withMessage("Conversion type is required")
    .isIn(["customer", "appointment", "jobcard"])
    .withMessage("Invalid conversion type"),

  body("appointmentData")
    .optional()
    .isObject()
    .withMessage("Appointment data must be an object"),

  body("jobCardData")
    .optional()
    .isObject()
    .withMessage("Job card data must be an object"),
];

module.exports = {
  createEnquiryValidation,
  updateEnquiryValidation,
  addFollowUpValidation,
  assignEnquiryValidation,
  convertEnquiryValidation,
};
