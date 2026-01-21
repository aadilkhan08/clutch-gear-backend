/**
 * User Validators
 * Validation rules for user endpoints
 */
const { body } = require("express-validator");

const updateProfileValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Please enter a valid email")
    .normalizeEmail(),
  body("address.street")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Street cannot exceed 200 characters"),
  body("address.city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),
  body("address.state")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),
  body("address.pincode")
    .optional()
    .matches(/^\d{6}$/)
    .withMessage("Please enter a valid 6-digit pincode"),
];

const updateDeviceInfoValidation = [
  body("deviceId").optional().trim(),
  body("deviceType")
    .optional()
    .isIn(["android", "ios", "web"])
    .withMessage("Invalid device type"),
  body("fcmToken").optional().trim(),
];

// Admin-only: role changes are backend-controlled; users cannot self-assign.
// Only allow promoting/demoting to mechanic.
const updateUserRoleValidation = [
  body("role")
    .exists()
    .withMessage("Role is required")
    .isIn(["user", "mechanic"])
    .withMessage("Role must be either 'user' or 'mechanic'"),
];

module.exports = {
  updateProfileValidation,
  updateDeviceInfoValidation,
  updateUserRoleValidation,
};
