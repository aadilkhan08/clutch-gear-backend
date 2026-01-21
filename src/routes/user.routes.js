/**
 * User Routes
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { userController } = require("../controllers");
const { authenticate, validate } = require("../middlewares");
const {
  updateProfileValidation,
  updateDeviceInfoValidation,
} = require("../validators");

// Multer config for image upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// Profile routes
router.get("/profile", userController.getProfile);
router.put(
  "/profile",
  updateProfileValidation,
  validate,
  userController.updateProfile
);
router.put(
  "/profile/image",
  upload.single("image"),
  userController.updateProfileImage
);
router.delete("/profile/image", userController.deleteProfileImage);

// Device info
router.put(
  "/device",
  updateDeviceInfoValidation,
  validate,
  userController.updateDeviceInfo
);

// Account
router.delete("/account", userController.deleteAccount);

module.exports = router;
