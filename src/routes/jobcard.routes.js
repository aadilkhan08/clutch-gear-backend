/**
 * Job Card Routes
 */
const express = require("express");
const router = express.Router();
const { jobcardController } = require("../controllers");
const { authenticate, validate, validateObjectId } = require("../middlewares");
const { approveItemsValidation } = require("../validators");

// All routes require authentication
router.use(authenticate);

// User routes
router.get("/", jobcardController.getJobCards);
router.get("/active", jobcardController.getActiveJobCards);
router.get("/:id", validateObjectId("id"), jobcardController.getJobCard);
router.get(
  "/:id/history",
  validateObjectId("id"),
  jobcardController.getJobCardHistory
);
router.get(
  "/:id/inspection-media",
  validateObjectId("id"),
  jobcardController.getInspectionMedia
);

// Estimate routes (Customer)
router.get(
  "/:id/estimate",
  validateObjectId("id"),
  jobcardController.getEstimate
);
router.post(
  "/:id/estimate/approve",
  validateObjectId("id"),
  jobcardController.approveEstimate
);
router.post(
  "/:id/estimate/reject",
  validateObjectId("id"),
  jobcardController.rejectEstimate
);

// Legacy item approval route
router.put(
  "/:id/approve",
  validateObjectId("id"),
  approveItemsValidation,
  validate,
  jobcardController.approveJobItems
);

module.exports = router;
