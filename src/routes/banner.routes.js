/**
 * Banner Routes (Public)
 * Customer-facing banner endpoint
 */
const express = require("express");
const router = express.Router();
const { bannerController } = require("../controllers");

// Public – get the active banner (no auth required)
router.get("/active", bannerController.getActiveBanner);

module.exports = router;
