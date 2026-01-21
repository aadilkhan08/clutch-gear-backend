/**
 * Subscription Validator
 * Validation rules for subscription operations
 */
const { body, query, param } = require("express-validator");

const purchasePackageValidation = [
  body("packageId")
    .notEmpty()
    .withMessage("Package ID is required")
    .isMongoId()
    .withMessage("Invalid package ID"),
  body("vehicleId")
    .notEmpty()
    .withMessage("Vehicle ID is required")
    .isMongoId()
    .withMessage("Invalid vehicle ID"),
  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),
];

const verifyPaymentValidation = [
  body("razorpay_order_id")
    .notEmpty()
    .withMessage("Razorpay order ID is required"),
  body("razorpay_payment_id")
    .notEmpty()
    .withMessage("Razorpay payment ID is required"),
  body("razorpay_signature")
    .notEmpty()
    .withMessage("Razorpay signature is required"),
];

const useServiceValidation = [
  body("serviceId")
    .notEmpty()
    .withMessage("Service ID is required")
    .isMongoId()
    .withMessage("Invalid service ID"),
  body("jobCardId").optional().isMongoId().withMessage("Invalid job card ID"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const activateSubscriptionValidation = [
  body("paymentMethod")
    .optional()
    .isIn(["cash", "card", "upi", "bank-transfer", "online"])
    .withMessage("Invalid payment method"),
  body("transactionId")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Transaction ID cannot exceed 100 characters"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const cancelSubscriptionValidation = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
  body("refundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Refund amount cannot be negative"),
];

const extendSubscriptionValidation = [
  body("days")
    .notEmpty()
    .withMessage("Number of days is required")
    .isInt({ min: 1 })
    .withMessage("Days must be at least 1"),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
];

module.exports = {
  purchasePackageValidation,
  verifyPaymentValidation,
  useServiceValidation,
  activateSubscriptionValidation,
  cancelSubscriptionValidation,
  extendSubscriptionValidation,
};
