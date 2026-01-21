/**
 * Review Validators
 * Validation rules for review endpoints
 */
const { body } = require("express-validator");

const createReviewValidation = [
  body("jobCardId")
    .notEmpty()
    .withMessage("Job card is required")
    .isMongoId()
    .withMessage("Invalid job card ID"),
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("title")
    .optional()
    .trim()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value
    )
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),
  body("comment")
    .optional()
    .trim()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value
    )
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
  body("serviceQuality")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Service quality rating must be between 1 and 5"),
  body("timelinessRating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Timeliness rating must be between 1 and 5"),
  body("valueForMoney")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Value for money rating must be between 1 and 5"),
  body("staffBehavior")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Staff behavior rating must be between 1 and 5"),
  body("wouldRecommend")
    .optional()
    .isBoolean()
    .withMessage("Would recommend must be a boolean"),
];

const updateReviewValidation = [
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("title")
    .optional()
    .trim()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value
    )
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),
  body("comment")
    .optional()
    .trim()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value
    )
    .isLength({ max: 1000 })
    .withMessage("Comment cannot exceed 1000 characters"),
];

const adminResponseValidation = [
  body("response")
    .notEmpty()
    .withMessage("Response is required")
    .trim()
    .customSanitizer((value) =>
      typeof value === "string" ? value.replace(/<[^>]*>/g, "") : value
    )
    .isLength({ max: 500 })
    .withMessage("Response cannot exceed 500 characters"),
];

module.exports = {
  createReviewValidation,
  updateReviewValidation,
  adminResponseValidation,
};
