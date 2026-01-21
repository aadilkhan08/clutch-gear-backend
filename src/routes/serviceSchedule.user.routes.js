/**
 * Service Schedule Routes (Customer)
 */
const express = require("express");
const router = express.Router();
const { serviceScheduleController } = require("../controllers");
const { authenticate, validate } = require("../middlewares");
const { listScheduleValidation } = require("../validators");

router.use(authenticate);

router.get(
  "/",
  listScheduleValidation,
  validate,
  serviceScheduleController.listMySchedules
);

module.exports = router;
