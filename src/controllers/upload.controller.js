/**
 * Upload Controller
 * Handles image uploads via ImageKit
 */
const { imagekitService } = require("../services");
const { ApiResponse, ApiError, asyncHandler } = require("../utils");

/**
 * @desc    Get ImageKit auth params for client-side upload
 * @route   GET /api/v1/upload/auth
 * @access  Private
 */
const getUploadAuth = asyncHandler(async (req, res) => {
  const authParams = imagekitService.getAuthParams();
  ApiResponse.success(res, "Auth params generated successfully", authParams);
});

/**
 * @desc    Upload single image
 * @route   POST /api/v1/upload/image
 * @access  Private
 */
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please upload an image");
  }

  const { folder = "general" } = req.body;

  const result = await imagekitService.uploadImage(
    req.file.buffer,
    req.file.originalname,
    folder
  );

  ApiResponse.success(res, "Image uploaded successfully", result);
});

/**
 * @desc    Upload multiple images
 * @route   POST /api/v1/upload/images
 * @access  Private
 */
const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest("Please upload at least one image");
  }

  const { folder = "general" } = req.body;

  const results = await imagekitService.uploadMultipleImages(req.files, folder);

  ApiResponse.success(res, "Images uploaded successfully", results);
});

/**
 * @desc    Delete image
 * @route   DELETE /api/v1/upload/:fileId
 * @access  Private
 */
const deleteImage = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  await imagekitService.deleteImage(fileId);

  ApiResponse.success(res, "Image deleted successfully");
});

module.exports = {
  getUploadAuth,
  uploadImage,
  uploadImages,
  deleteImage,
};
