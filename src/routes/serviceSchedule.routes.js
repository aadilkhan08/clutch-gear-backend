/**
 * Service Schedule Routes (Admin)
 */
const express = require("express");
const router = express.Router();
const { serviceScheduleController } = require("../controllers");
const { authenticate, isAdmin, validate } = require("../middlewares");
const {
  createScheduleValidation,
  updateScheduleValidation,
  listScheduleValidation,
  markCompletedValidation,
} = require("../validators");

router.use(authenticate, isAdmin);

router.get("/dashboard", serviceScheduleController.getDashboard);
router.get(
  "/",
  listScheduleValidation,
  validate,
  serviceScheduleController.listSchedules
);
router.post(
  "/",
  createScheduleValidation,
  validate,
  serviceScheduleController.createSchedule
);
router.get("/:id", serviceScheduleController.getScheduleById);
router.put(
  "/:id",
  updateScheduleValidation,
  validate,
  serviceScheduleController.updateSchedule
);
router.put(
  "/:id/complete",
  markCompletedValidation,
  validate,
  serviceScheduleController.markCompleted
);

module.exports = router;
