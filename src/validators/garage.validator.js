/**
 * Garage Profile Validators
 */
const { body } = require("express-validator");

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const updateGarageProfileValidation = [
  body("garageName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Garage name must be between 2 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),
  body("address.line1")
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage("Address line is required"),
  body("address.city")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("City is required"),
  body("address.state")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("State is required"),
  body("address.pincode")
    .optional()
    .isLength({ min: 6, max: 6 })
    .withMessage("Pincode must be 6 digits"),
  body("contact.phone")
    .optional()
    .trim()
    .isLength({ min: 8, max: 20 })
    .withMessage("Phone number is required"),
  body("contact.email").optional().isEmail().withMessage("Invalid email"),
  body("workingHours")
    .optional()
    .isArray()
    .withMessage("Working hours must be an array"),
  body("workingHours.*.day")
    .optional()
    .isIn(DAY_NAMES)
    .withMessage("Invalid day name"),
  body("workingHours.*.open")
    .optional()
    .isLength({ min: 4, max: 5 })
    .withMessage("Open time must be HH:mm"),
  body("workingHours.*.close")
    .optional()
    .isLength({ min: 4, max: 5 })
    .withMessage("Close time must be HH:mm"),
  body("servicesOffered")
    .optional()
    .isArray()
    .withMessage("Services offered must be an array"),
  body("socialLinks.googleMaps").optional().isURL(),
  body("socialLinks.instagram").optional().isURL(),
  body("socialLinks.website").optional().isURL(),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

module.exports = {
  updateGarageProfileValidation,
};
