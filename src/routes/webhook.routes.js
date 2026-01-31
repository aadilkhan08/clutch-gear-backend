/**
 * Webhook Routes
 */
const express = require("express");
const router = express.Router();
const { webhookController } = require("../controllers");

router.post("/msg91/events", webhookController.handleMsg91Events);

module.exports = router;
