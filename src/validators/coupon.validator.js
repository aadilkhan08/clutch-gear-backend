/**
 * Coupon Validators
 */
const { body, query } = require("express-validator");

const createCouponValidation = [
  body("code").trim().notEmpty().withMessage("Code is required"),
  body("description").optional().isLength({ max: 500 }),
  body("discountType")
    .isIn(["FLAT", "PERCENT"])
    .withMessage("Invalid discount type"),
  body("discountValue")
    .isFloat({ min: 0.01 })
    .withMessage("Discount value must be greater than 0"),
  body("maxDiscountAmount").optional().isFloat({ min: 0 }),
  body("minInvoiceAmount").optional().isFloat({ min: 0 }),
  body("validFrom").isISO8601().withMessage("Valid from is required"),
  body("validTill").isISO8601().withMessage("Valid till is required"),
  body("usageLimit").optional().isInt({ min: -1 }),
  body("perCustomerLimit").optional().isInt({ min: 1 }),
  body("isActive").optional().isBoolean(),
];

const updateCouponValidation = [
  body("description").optional().isLength({ max: 500 }),
  body("discountType")
    .optional()
    .isIn(["FLAT", "PERCENT"])
    .withMessage("Invalid discount type"),
  body("discountValue").optional().isFloat({ min: 0.01 }),
  body("maxDiscountAmount").optional().isFloat({ min: 0 }),
  body("minInvoiceAmount").optional().isFloat({ min: 0 }),
  body("validFrom").optional().isISO8601(),
  body("validTill").optional().isISO8601(),
  body("usageLimit").optional().isInt({ min: -1 }),
  body("perCustomerLimit").optional().isInt({ min: 1 }),
  body("isActive").optional().isBoolean(),
];

const validateCouponValidation = [
  body("code").trim().notEmpty().withMessage("Code is required"),
  body("jobCardId").isMongoId().withMessage("Job card is required"),
];

const listCouponValidation = [query("isActive").optional().isBoolean()];

module.exports = {
  createCouponValidation,
  updateCouponValidation,
  validateCouponValidation,
  listCouponValidation,
};
