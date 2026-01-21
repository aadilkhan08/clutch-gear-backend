/**
 * Super Admin Routes
 */
const express = require("express");
const router = express.Router();
const { superadminController } = require("../controllers");
const {
  authenticate,
  isSuperAdmin,
  validateObjectId,
  validate,
} = require("../middlewares");

// All routes require Super Admin authentication
router.use(authenticate, isSuperAdmin);

// Dashboard & analytics
router.get("/dashboard", superadminController.getDashboard);
router.get("/analytics/revenue", superadminController.getRevenueAnalytics);

// Admin management
router.get("/admins", superadminController.listAdmins);
router.get("/users", superadminController.listUsers);
router.post("/admins/promote", superadminController.promoteToAdmin);
router.post(
  "/admins/:id/revoke",
  validateObjectId("id"),
  superadminController.revokeAdmin
);

// Activity logs
router.get("/admins/activity", superadminController.getAdminActivity);

module.exports = router;
