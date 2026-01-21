/**
 * Garage Profile Routes
 */
const express = require("express");
const router = express.Router();
const { garageController } = require("../controllers");

// Public garage profile
router.get("/profile", garageController.getPublicProfile);

module.exports = router;
