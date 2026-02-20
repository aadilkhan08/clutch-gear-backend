/**
 * Promotion Routes (Public)
 * Customer-facing promotion endpoints
 */
const express = require("express");
const router = express.Router();
const { promotionController } = require("../controllers");
const { authenticate } = require("../middlewares");

// Public – get active promotions (no auth required for viewing banners)
router.get("/active", promotionController.getActivePromotions);

// Record click (optionally authenticated)
router.post("/:id/click", promotionController.recordClick);

module.exports = router;
