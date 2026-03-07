/**
 * Testimonial Validator
 * Request validation for testimonial endpoints
 */
const { body, query } = require("express-validator");

const createTestimonialValidation = [
    body("customerName")
        .trim()
        .notEmpty()
        .withMessage("Customer name is required")
        .isLength({ max: 100 })
        .withMessage("Customer name cannot exceed 100 characters"),
    body("customerImage").optional(),
    body("customerImage.url").optional(),
    body("video")
        .notEmpty()
        .withMessage("Video is required"),
    body("video.url")
        .notEmpty()
        .withMessage("Video URL is required"),
    body("caption")
        .optional()
        .isLength({ max: 200 })
        .withMessage("Caption cannot exceed 200 characters"),
    body("rating")
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage("Rating must be between 1 and 5"),
    body("serviceName")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Service name cannot exceed 100 characters"),
    body("priority")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Priority must be between 1 and 100"),
    body("isActive").optional().isBoolean(),
];

const updateTestimonialValidation = [
    body("customerName")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Customer name cannot exceed 100 characters"),
    body("customerImage").optional(),
    body("customerImage.url").optional(),
    body("video").optional(),
    body("video.url").optional(),
    body("caption")
        .optional()
        .isLength({ max: 200 })
        .withMessage("Caption cannot exceed 200 characters"),
    body("rating")
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage("Rating must be between 1 and 5"),
    body("serviceName")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Service name cannot exceed 100 characters"),
    body("priority")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Priority must be between 1 and 100"),
    body("isActive").optional().isBoolean(),
];

const listTestimonialValidation = [
    query("isActive").optional().isBoolean(),
];

module.exports = {
    createTestimonialValidation,
    updateTestimonialValidation,
    listTestimonialValidation,
};
