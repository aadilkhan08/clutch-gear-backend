/**
 * Washing User Routes
 * Customer-facing endpoints for viewing car washing history (read-only)
 */
const express = require("express");
const router = express.Router();
const { washingController } = require("../controllers");
const { authenticate, validateObjectId } = require("../middlewares");

// All routes require customer authentication
router.use(authenticate);

/**
 * Get customer's vehicles with wash subscription status
 * @route GET /api/v1/washing/my-vehicles
 */
router.get("/my-vehicles", washingController.getCustomerWashVehicles);

/**
 * Get wash history for a specific vehicle
 * @route GET /api/v1/washing/history/:vehicleId
 * @query month - Optional month (1-12)
 * @query year - Optional year
 * @query page - Pagination page
 * @query limit - Items per page
 */
router.get(
  "/history/:vehicleId",
  validateObjectId("vehicleId"),
  washingController.getCustomerWashHistory
);

/**
 * Get wash summary for a vehicle (monthly stats)
 * @route GET /api/v1/washing/summary/:vehicleId
 * @query month - Optional month (1-12)
 * @query year - Optional year
 */
router.get(
  "/summary/:vehicleId",
  validateObjectId("vehicleId"),
  washingController.getCustomerWashSummary
);

module.exports = router;
