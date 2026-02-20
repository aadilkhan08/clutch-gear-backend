/**
 * Partner Validator
 * Request validation for partner endpoints
 */
const { body, query } = require("express-validator");

const createPartnerValidation = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Partner name is required")
        .isLength({ max: 100 })
        .withMessage("Name cannot exceed 100 characters"),
    body("subtitle")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Subtitle cannot exceed 100 characters"),
    body("description")
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage("Description cannot exceed 300 characters"),
    body("logo").optional(),
    body("logo.url").optional().isString(),
    body("logoText")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("Logo text cannot exceed 20 characters"),
    body("logoColor").optional().trim(),
    body("bgColor").optional().trim(),
    body("priority")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Priority must be between 1 and 100"),
    body("isActive").optional().isBoolean(),
];

const updatePartnerValidation = [
    body("name")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Name cannot exceed 100 characters"),
    body("subtitle")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Subtitle cannot exceed 100 characters"),
    body("description")
        .optional()
        .trim()
        .isLength({ max: 300 })
        .withMessage("Description cannot exceed 300 characters"),
    body("logo").optional(),
    body("logo.url").optional().isString(),
    body("logoText")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("Logo text cannot exceed 20 characters"),
    body("logoColor").optional().trim(),
    body("bgColor").optional().trim(),
    body("priority")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Priority must be between 1 and 100"),
    body("isActive").optional().isBoolean(),
];

const listPartnerValidation = [
    query("isActive").optional().isBoolean(),
];

module.exports = {
    createPartnerValidation,
    updatePartnerValidation,
    listPartnerValidation,
};
