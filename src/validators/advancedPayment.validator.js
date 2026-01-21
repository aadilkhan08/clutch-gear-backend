/**
 * Advanced Payment Validators
 */
const { body, param, query } = require("express-validator");

const createInvoicePaymentValidation = [
  body("invoiceId").isMongoId().withMessage("Invalid invoice ID"),
  body("customerId").isMongoId().withMessage("Invalid customer ID"),
  body("totalAmount")
    .isFloat({ min: 0.01 })
    .withMessage("Total amount must be greater than 0"),
  body("paymentMethod")
    .optional()
    .isIn(["UPI", "CARD", "CASH", "RAZORPAY"])
    .withMessage("Invalid payment method"),
];

const addTransactionValidation = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("method")
    .isIn(["UPI", "CARD", "CASH", "RAZORPAY"])
    .withMessage("Invalid payment method"),
  body("transactionId").optional().isLength({ max: 120 }),
];

const markPaidValidation = [
  param("id").isMongoId().withMessage("Invalid payment ID"),
  body("method")
    .optional()
    .isIn(["UPI", "CARD", "CASH", "RAZORPAY"])
    .withMessage("Invalid payment method"),
  body("transactionId").optional().isLength({ max: 120 }),
];

const refundRequestValidation = [
  body("paymentId").isMongoId().withMessage("Invalid payment ID"),
  body("requestedAmount")
    .isFloat({ min: 0.01 })
    .withMessage("Requested amount must be greater than 0"),
  body("reason")
    .notEmpty()
    .withMessage("Reason is required")
    .isLength({ max: 500 })
    .withMessage("Reason too long"),
];

const refundActionValidation = [
  param("id").isMongoId().withMessage("Invalid refund ID"),
  body("adminRemarks").optional().isLength({ max: 500 }),
];

const listPaymentValidation = [
  query("paymentStatus")
    .optional()
    .isIn(["PARTIAL", "PAID", "REFUND_PENDING", "REFUNDED"]),
];

module.exports = {
  createInvoicePaymentValidation,
  addTransactionValidation,
  markPaidValidation,
  refundRequestValidation,
  refundActionValidation,
  listPaymentValidation,
};
