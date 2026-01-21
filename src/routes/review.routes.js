/**
 * Review Routes
 */
const express = require("express");
const router = express.Router();
const { reviewController } = require("../controllers");
const {
  authenticate,
  optionalAuth,
  validate,
  validateObjectId,
} = require("../middlewares");
const {
  createReviewValidation,
  updateReviewValidation,
} = require("../validators");

// Public routes
router.get("/public", reviewController.getPublicReviews);
router.get("/stats", reviewController.getWorkshopStats);

// Protected routes
router.get("/", authenticate, reviewController.getMyReviews);
router.post(
  "/",
  authenticate,
  createReviewValidation,
  validate,
  reviewController.createReview
);
router.put(
  "/:id",
  authenticate,
  validateObjectId("id"),
  updateReviewValidation,
  validate,
  reviewController.updateReview
);
router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  reviewController.deleteReview
);

module.exports = router;
