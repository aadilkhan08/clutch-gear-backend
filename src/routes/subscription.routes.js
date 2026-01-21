/**
 * Subscription Routes
 * Customer subscription management routes
 */
const express = require("express");
const router = express.Router();
const { subscriptionController } = require("../controllers");
const { authenticate, validate, validateObjectId } = require("../middlewares");
const {
  purchasePackageValidation,
  verifyPaymentValidation,
} = require("../validators/subscription.validator");

// All routes require authentication
router.use(authenticate);

// Get my subscriptions
router.get("/", subscriptionController.getMySubscriptions);

// Check service coverage
router.get(
  "/check-service/:serviceId",
  validateObjectId("serviceId"),
  subscriptionController.checkServiceCoverage
);

// Get subscription by ID
router.get(
  "/:id",
  validateObjectId("id"),
  subscriptionController.getSubscriptionById
);

// Purchase a package (create subscription)
router.post(
  "/",
  purchasePackageValidation,
  validate,
  subscriptionController.purchasePackage
);

// Create payment order for subscription
router.post(
  "/:id/payment/order",
  validateObjectId("id"),
  subscriptionController.createPaymentOrder
);

// Verify payment and activate
router.post(
  "/:id/payment/verify",
  validateObjectId("id"),
  verifyPaymentValidation,
  validate,
  subscriptionController.verifyPaymentAndActivate
);

module.exports = router;
