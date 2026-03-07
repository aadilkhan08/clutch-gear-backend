/**
 * Banner Validator
 * Request validation for banner endpoints
 */
const { body, query } = require("express-validator");

const createBannerValidation = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ max: 120 })
        .withMessage("Title cannot exceed 120 characters"),
    body("subtitle")
        .optional()
        .isLength({ max: 200 })
        .withMessage("Subtitle cannot exceed 200 characters"),
    body("image")
        .notEmpty()
        .withMessage("Banner image is required"),
    body("image.url")
        .notEmpty()
        .withMessage("Banner image URL is required"),
    body("linkType")
        .optional()
        .isIn(["service", "url", "booking", "none"])
        .withMessage("Invalid link type"),
    body("linkValue").optional().trim(),
    body("isActive").optional().isBoolean(),
];

const updateBannerValidation = [
    body("title")
        .optional()
        .trim()
        .isLength({ max: 120 })
        .withMessage("Title cannot exceed 120 characters"),
    body("subtitle")
        .optional()
        .isLength({ max: 200 })
        .withMessage("Subtitle cannot exceed 200 characters"),
    body("image").optional(),
    body("image.url").optional(),
    body("linkType")
        .optional()
        .isIn(["service", "url", "booking", "none"])
        .withMessage("Invalid link type"),
    body("linkValue").optional().trim(),
    body("isActive").optional().isBoolean(),
];

const listBannerValidation = [
    query("isActive").optional().isBoolean(),
];

module.exports = {
    createBannerValidation,
    updateBannerValidation,
    listBannerValidation,
};
