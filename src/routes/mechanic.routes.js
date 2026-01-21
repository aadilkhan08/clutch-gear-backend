/**
 * Mechanic Routes
 * Mechanic-only endpoints
 */
const express = require("express");
const multer = require("multer");
const router = express.Router();

const { jobcardController } = require("../controllers");
const {
  authenticate,
  isMechanic,
  validate,
  validateObjectId,
} = require("../middlewares");
const { mechanicUpdateStatusValidation } = require("../validators");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

router.use(authenticate, isMechanic);

router.get("/jobcards", jobcardController.getAssignedJobCards);
router.get(
  "/jobcards/:id",
  validateObjectId("id"),
  jobcardController.getAssignedJobCard
);
router.patch(
  "/jobcards/:id/status",
  validateObjectId("id"),
  mechanicUpdateStatusValidation,
  validate,
  jobcardController.updateAssignedJobCardStatus
);
router.post(
  "/jobcards/:id/images",
  validateObjectId("id"),
  upload.array("images", 10),
  jobcardController.uploadAssignedJobCardImages
);

module.exports = router;
