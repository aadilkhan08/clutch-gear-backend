/**
 * Service Schedule Routes (Customer)
 */
const express = require("express");
const router = express.Router();
const { serviceScheduleController } = require("../controllers");
const { authenticate, validate, validateObjectId } = require("../middlewares");
const { listScheduleValidation } = require("../validators");

router.use(authenticate);

// List customer's schedules
router.get(
  "/",
  listScheduleValidation,
  validate,
  serviceScheduleController.listMySchedules
);

// Get schedule detail (read-only)
router.get(
  "/:id",
  validateObjectId("id"),
  serviceScheduleController.getMyScheduleById
);

module.exports = router;
