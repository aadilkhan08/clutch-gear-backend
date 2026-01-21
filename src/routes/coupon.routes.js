/**
 * Coupon Routes
 */
const express = require("express");
const router = express.Router();
const { couponController } = require("../controllers");
const { authenticate, validate } = require("../middlewares");
const { validateCouponValidation } = require("../validators");

// Public coupons
router.get("/public", couponController.listPublicCoupons);

// Authenticated user actions
router.use(authenticate);

router.post(
  "/validate",
  validateCouponValidation,
  validate,
  couponController.validateCoupon
);
router.post(
  "/apply",
  validateCouponValidation,
  validate,
  couponController.applyCoupon
);

module.exports = router;
