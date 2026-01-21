/**
 * Package Routes
 * Public routes for viewing packages
 */
const express = require("express");
const router = express.Router();
const { packageController } = require("../controllers");
const { validateObjectId } = require("../middlewares");

// Public routes - no authentication required
router.get("/", packageController.getAvailablePackages);
router.get("/:id", validateObjectId("id"), packageController.getPackageById);

module.exports = router;
