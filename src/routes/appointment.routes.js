/**
 * Appointment Routes
 */
const express = require("express");
const router = express.Router();
const { appointmentController } = require("../controllers");
const { authenticate, validate, validateObjectId } = require("../middlewares");
const {
  createAppointmentValidation,
  cancelAppointmentValidation,
} = require("../validators");

// All routes require authentication
router.use(authenticate);

// User routes
router.get("/", appointmentController.getAppointments);
router.get("/upcoming", appointmentController.getUpcomingAppointments);
router.get("/slots", appointmentController.getAvailableSlots);
router.post(
  "/",
  createAppointmentValidation,
  validate,
  appointmentController.createAppointment
);
router.get(
  "/:id",
  validateObjectId("id"),
  appointmentController.getAppointment
);
router.put(
  "/:id/cancel",
  validateObjectId("id"),
  cancelAppointmentValidation,
  validate,
  appointmentController.cancelAppointment
);

module.exports = router;
