/**
 * Service Routes
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { serviceController } = require("../controllers");
const {
  authenticate,
  isAdmin,
  validate,
  validateObjectId,
} = require("../middlewares");
const {
  createServiceValidation,
  updateServiceValidation,
} = require("../validators");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Public routes
router.get("/", serviceController.getServices);
router.get("/popular", serviceController.getPopularServices);
router.get("/categories/list", serviceController.getCategories);
router.get("/category/:category", serviceController.getServicesByCategory);

// Admin list route (includes inactive)
router.get(
  "/admin/list",
  authenticate,
  isAdmin,
  serviceController.getServicesAdmin
);
router.get("/:id", validateObjectId("id"), serviceController.getService);

// Admin routes
router.post(
  "/",
  authenticate,
  isAdmin,
  createServiceValidation,
  validate,
  serviceController.createService
);
router.put(
  "/:id",
  authenticate,
  isAdmin,
  validateObjectId("id"),
  updateServiceValidation,
  validate,
  serviceController.updateService
);
router.put(
  "/:id/image",
  authenticate,
  isAdmin,
  validateObjectId("id"),
  upload.single("image"),
  serviceController.updateServiceImage
);
router.delete(
  "/:id",
  authenticate,
  isAdmin,
  validateObjectId("id"),
  serviceController.deleteService
);

module.exports = router;
