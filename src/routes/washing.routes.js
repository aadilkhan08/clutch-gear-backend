/**
 * Washing Routes
 * All car washing module endpoints
 */
const express = require("express");
const router = express.Router();
const { washingController } = require("../controllers");
const {
  authenticate,
  isAdmin,
  validate,
  validateObjectId,
} = require("../middlewares");
const {
  createZoneValidation,
  updateZoneValidation,
  createAreaValidation,
  updateAreaValidation,
  markWashStatusValidation,
  bulkMarkStatusValidation,
  markHolidayValidation,
  dailyReportValidation,
  monthlyReportValidation,
  exportReportValidation,
  assignVehicleValidation,
  initializeDailyWashValidation,
} = require("../validators");

// All routes require admin authentication
router.use(authenticate, isAdmin);

/**
 * ==================== ZONE ROUTES ====================
 */

// Get all zones
router.get("/zones", washingController.getZones);

// Create zone
router.post(
  "/zones",
  createZoneValidation,
  validate,
  washingController.createZone
);

// Update zone
router.put(
  "/zones/:id",
  validateObjectId("id"),
  updateZoneValidation,
  validate,
  washingController.updateZone
);

// Delete zone
router.delete(
  "/zones/:id",
  validateObjectId("id"),
  washingController.deleteZone
);

/**
 * ==================== AREA ROUTES ====================
 */

// Get all areas (filter by zone optional)
router.get("/areas", washingController.getAreas);

// Create area
router.post(
  "/areas",
  createAreaValidation,
  validate,
  washingController.createArea
);

// Update area
router.put(
  "/areas/:id",
  validateObjectId("id"),
  updateAreaValidation,
  validate,
  washingController.updateArea
);

// Delete area
router.delete(
  "/areas/:id",
  validateObjectId("id"),
  washingController.deleteArea
);

/**
 * ==================== DASHBOARD & VEHICLES ====================
 */

// Get washing dashboard stats
router.get("/dashboard", washingController.getDashboard);

// Get vehicles for daily washing
router.get("/vehicles", washingController.getVehiclesForWashing);

// Initialize daily wash entries
router.post(
  "/initialize",
  initializeDailyWashValidation,
  validate,
  washingController.initializeDailyWash
);

// Assign vehicle to zone/area
router.put(
  "/vehicles/:vehicleId/assign",
  assignVehicleValidation,
  validate,
  washingController.assignVehicleToZone
);

/**
 * ==================== WASH STATUS ====================
 */

// Mark wash status for single vehicle
router.put(
  "/mark/:vehicleId",
  markWashStatusValidation,
  validate,
  washingController.markWashStatus
);

// Bulk mark status
router.post(
  "/mark/bulk",
  bulkMarkStatusValidation,
  validate,
  washingController.bulkMarkStatus
);

// Mark holiday for zone/area
router.post(
  "/holiday",
  markHolidayValidation,
  validate,
  washingController.markHoliday
);

/**
 * ==================== REPORTS ====================
 */

// Get daily report
router.get(
  "/reports/daily",
  dailyReportValidation,
  validate,
  washingController.getDailyReport
);

// Get monthly report
router.get(
  "/reports/monthly",
  monthlyReportValidation,
  validate,
  washingController.getMonthlyReport
);

// Export report (CSV/JSON)
router.get(
  "/reports/export",
  exportReportValidation,
  validate,
  washingController.exportReport
);

module.exports = router;
