/**
 * Payment Routes
 */
const express = require("express");
const router = express.Router();
const {
  paymentController,
  advancedPaymentController,
} = require("../controllers");
const { authenticate, validateObjectId, validate } = require("../middlewares");
const {
  refundRequestValidation,
  listPaymentValidation,
} = require("../validators");

// Public token-based Razorpay endpoints
router.get(
  "/razorpay/checkout/:token",
  paymentController.renderRazorpayCheckout
);
router.post("/razorpay/verify", paymentController.verifyRazorpayPayment);

// All remaining routes require authentication
router.use(authenticate);

// User routes
router.get("/", paymentController.getPayments);
router.get("/:id", validateObjectId("id"), paymentController.getPayment);
router.post(
  "/:id/razorpay/order",
  validateObjectId("id"),
  paymentController.createRazorpayOrderForPayment
);
router.post(
  "/:id/razorpay/verify",
  validateObjectId("id"),
  paymentController.verifyRazorpayPaymentNativeUser
);
router.get(
  "/:id/receipt",
  validateObjectId("id"),
  paymentController.downloadReceipt
);
router.get(
  "/jobcard/:jobCardId",
  validateObjectId("jobCardId"),
  paymentController.getJobCardPayments
);

// Advanced payments (User)
router.get(
  "/advanced",
  listPaymentValidation,
  validate,
  advancedPaymentController.listMyPayments
);
router.post(
  "/refunds",
  refundRequestValidation,
  validate,
  advancedPaymentController.requestRefund
);
router.get("/refunds", advancedPaymentController.listMyRefunds);

module.exports = router;
