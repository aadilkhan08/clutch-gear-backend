/**
 * Vehicle Routes
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { vehicleController } = require("../controllers");
const { authenticate, validate, validateObjectId } = require("../middlewares");
const {
  addVehicleValidation,
  updateVehicleValidation,
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

// All routes require authentication
router.use(authenticate);

router.get("/", vehicleController.getVehicles);
router.post("/", addVehicleValidation, validate, vehicleController.addVehicle);
router.get("/:id", validateObjectId("id"), vehicleController.getVehicle);
router.put(
  "/:id",
  validateObjectId("id"),
  updateVehicleValidation,
  validate,
  vehicleController.updateVehicle
);
router.delete("/:id", validateObjectId("id"), vehicleController.deleteVehicle);

// Vehicle images
router.post(
  "/:id/images",
  validateObjectId("id"),
  upload.array("images", 5),
  vehicleController.uploadVehicleImages
);
router.delete(
  "/:id/images/:imageId",
  validateObjectId("id"),
  vehicleController.deleteVehicleImage
);

module.exports = router;
