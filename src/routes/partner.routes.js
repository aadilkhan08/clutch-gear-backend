/**
 * Partner Routes (Public)
 * Customer-facing partner endpoints
 */
const express = require("express");
const router = express.Router();
const { partnerController } = require("../controllers");

// Public – get active partners (no auth required)
router.get("/active", partnerController.getActivePartners);

module.exports = router;
