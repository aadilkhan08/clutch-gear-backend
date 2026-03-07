/**
 * Mechanic Validator
 * Validation rules for mechanic management
 */
const { body } = require("express-validator");

/**
 * Create mechanic validation
 */
const createMechanicValidation = [
    body("mobile")
        .notEmpty()
        .withMessage("Mobile number is required")
        .matches(/^[6-9]\d{9}$/)
        .withMessage("Please enter a valid 10-digit Indian mobile number"),
    body("name")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Name cannot exceed 100 characters"),
    body("email").optional().isEmail().withMessage("Please enter a valid email"),
];

module.exports = {
    createMechanicValidation,
};
