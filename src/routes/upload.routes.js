/**
 * Upload Routes
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { uploadController } = require("../controllers");
const { authenticate } = require("../middlewares");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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

// Upload routes
router.get("/auth", uploadController.getUploadAuth);
router.post("/image", upload.single("image"), uploadController.uploadImage);
router.post(
  "/images",
  upload.array("images", 10),
  uploadController.uploadImages
);
router.delete("/:fileId", uploadController.deleteImage);

module.exports = router;
