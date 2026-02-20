/**
 * Vehicle Catalog Routes
 * Public endpoints (authenticated) for brand / model suggestions.
 */
const express = require("express");
const router = express.Router();
const { vehicleCatalogController } = require("../controllers");
const { authenticate } = require("../middlewares");

// All routes require authentication
router.use(authenticate);

// Full catalog dump (for client-side caching)
router.get("/all", vehicleCatalogController.getFullCatalog);

// Brands for a vehicle type – optional ?search=query
router.get("/brands/:vehicleType", vehicleCatalogController.getBrands);

// Models for a brand+type – optional ?search=query
router.get("/models/:vehicleType/:brand", vehicleCatalogController.getModels);

module.exports = router;
