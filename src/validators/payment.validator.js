/**
 * Payment Validators
 * Validation rules for payment endpoints
 */
const { body } = require("express-validator");

const createPaymentValidation = [
  body("jobCardId")
    .notEmpty()
    .withMessage("Job card is required")
    .isMongoId()
    .withMessage("Invalid job card ID"),
  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("paymentType")
    .notEmpty()
    .withMessage("Payment type is required")
    .isIn(["advance", "partial", "full", "refund"])
    .withMessage("Invalid payment type"),
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["cash", "card", "upi", "netbanking", "wallet", "cheque", "other"])
    .withMessage("Invalid payment method"),
  body("status")
    .optional()
    .isIn(["pending", "completed"])
    .withMessage("Invalid status"),
  body("transactionId")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Transaction ID cannot exceed 100 characters"),
  body("transactionId").custom((value, { req }) => {
    const method = req.body?.paymentMethod;
    const type = req.body?.paymentType;
    const status = req.body?.status;

    const isCash = method === "cash";
    const isRefund = type === "refund";
    const isPending = status === "pending";

    if (isCash && !isRefund && !isPending) {
      if (!value || String(value).trim().length === 0) {
        throw new Error("Bill number is required for cash payments");
      }
    }
    return true;
  }),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const updatePaymentValidation = [
  body("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded"])
    .withMessage("Invalid status"),
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

const refundPaymentValidation = [
  body("amount")
    .notEmpty()
    .withMessage("Refund amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("reason")
    .notEmpty()
    .withMessage("Refund reason is required")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
];

module.exports = {
  createPaymentValidation,
  updatePaymentValidation,
  refundPaymentValidation,
};
