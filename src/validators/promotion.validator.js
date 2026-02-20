/**
 * Promotion Validator
 * Request validation for promotion endpoints
 */
const { body, query } = require("express-validator");

const createPromotionValidation = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ max: 100 })
        .withMessage("Title cannot exceed 100 characters"),
    body("description")
        .optional()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    body("bannerImage")
        .notEmpty()
        .withMessage("Banner image is required"),
    body("bannerImage.url")
        .notEmpty()
        .withMessage("Banner image URL is required"),
    body("ctaType")
        .optional()
        .isIn(["service", "package", "url", "booking", "none"])
        .withMessage("Invalid CTA type"),
    body("ctaValue").optional().trim(),
    body("ctaLabel")
        .optional()
        .isLength({ max: 30 })
        .withMessage("CTA label cannot exceed 30 characters"),
    body("startDate")
        .notEmpty()
        .withMessage("Start date is required")
        .isISO8601()
        .withMessage("Invalid start date"),
    body("endDate")
        .notEmpty()
        .withMessage("End date is required")
        .isISO8601()
        .withMessage("Invalid end date"),
    body("priority")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Priority must be between 1 and 100"),
    body("isActive").optional().isBoolean(),
    body("tags").optional().isArray(),
    body("tags.*").optional().isString().trim(),
];

const updatePromotionValidation = [
    body("title")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Title cannot exceed 100 characters"),
    body("description")
        .optional()
        .isLength({ max: 500 })
        .withMessage("Description cannot exceed 500 characters"),
    body("bannerImage").optional(),
    body("bannerImage.url").optional(),
    body("ctaType")
        .optional()
        .isIn(["service", "package", "url", "booking", "none"])
        .withMessage("Invalid CTA type"),
    body("ctaValue").optional().trim(),
    body("ctaLabel")
        .optional()
        .isLength({ max: 30 })
        .withMessage("CTA label cannot exceed 30 characters"),
    body("startDate").optional().isISO8601().withMessage("Invalid start date"),
    body("endDate").optional().isISO8601().withMessage("Invalid end date"),
    body("priority")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Priority must be between 1 and 100"),
    body("isActive").optional().isBoolean(),
    body("tags").optional().isArray(),
    body("tags.*").optional().isString().trim(),
];

const listPromotionValidation = [
    query("isActive").optional().isBoolean(),
    query("tag").optional().isString(),
];

module.exports = {
    createPromotionValidation,
    updatePromotionValidation,
    listPromotionValidation,
};
