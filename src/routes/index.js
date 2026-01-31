/**
 * Routes Index
 * Central route registration
 */
const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const vehicleRoutes = require("./vehicle.routes");
const serviceRoutes = require("./service.routes");
const appointmentRoutes = require("./appointment.routes");
const jobcardRoutes = require("./jobcard.routes");
const paymentRoutes = require("./payment.routes");
const reviewRoutes = require("./review.routes");
const garageRoutes = require("./garage.routes");
const couponRoutes = require("./coupon.routes");
const insuranceJobRoutes = require("./insuranceJob.routes");
const uploadRoutes = require("./upload.routes");
const adminRoutes = require("./admin.routes");
const superadminRoutes = require("./superadmin.routes");
const mechanicRoutes = require("./mechanic.routes");
const inventoryRoutes = require("./inventory.routes");
const packageRoutes = require("./package.routes");
const subscriptionRoutes = require("./subscription.routes");
const washingRoutes = require("./washing.routes");
const washingUserRoutes = require("./washing.user.routes");
const serviceScheduleRoutes = require("./serviceSchedule.routes");
const serviceScheduleUserRoutes = require("./serviceSchedule.user.routes");
const invoiceRoutes = require("./invoice.routes");
const notificationRoutes = require("./notification.routes");
const webhookRoutes = require("./webhook.routes");

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "ClutchGear API is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/services", serviceRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/jobcards", jobcardRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/garage", garageRoutes);
router.use("/coupons", couponRoutes);
router.use("/insurance-jobs", insuranceJobRoutes);
router.use("/upload", uploadRoutes);
router.use("/admin", adminRoutes);
router.use("/admin/inventory", inventoryRoutes);
router.use("/admin/washing", washingRoutes);
router.use("/washing", washingUserRoutes);
router.use("/admin/service-schedules", serviceScheduleRoutes);
router.use("/superadmin", superadminRoutes);
router.use("/mechanic", mechanicRoutes);
router.use("/packages", packageRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/service-schedules", serviceScheduleUserRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/notifications", notificationRoutes);
router.use("/webhooks", webhookRoutes);

module.exports = router;
