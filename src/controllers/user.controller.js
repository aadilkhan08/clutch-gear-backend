/**
 * User Controller
 * Handles user profile operations
 */
const { User } = require("../models");
const { imagekitService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  sanitizeObject,
} = require("../utils");

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  ApiResponse.success(
    res,
    "Profile fetched successfully",
    user.toPublicProfile()
  );
});

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  if (req.body?.mobile !== undefined) {
    throw ApiError.badRequest("Mobile number cannot be updated");
  }

  const { name, email, address, isProfileComplete } = req.body;

  const updateData = sanitizeObject({
    name,
    email,
    address,
    isProfileComplete,
  });

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  ApiResponse.success(
    res,
    "Profile updated successfully",
    user.toPublicProfile()
  );
});

/**
 * @desc    Update profile image
 * @route   PUT /api/v1/users/profile/image
 * @access  Private
 */
const updateProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please upload an image");
  }

  const user = await User.findById(req.userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Delete old image if exists
  if (user.profileImage?.fileId) {
    try {
      await imagekitService.deleteImage(user.profileImage.fileId);
    } catch (error) {
      console.error("Failed to delete old image:", error);
    }
  }

  // Upload new image
  const uploadResult = await imagekitService.uploadImage(
    req.file.buffer,
    `profile_${req.userId}`,
    "profiles"
  );

  // Update user
  user.profileImage = {
    url: uploadResult.url,
    fileId: uploadResult.fileId,
  };
  await user.save();

  ApiResponse.success(
    res,
    "Profile image updated successfully",
    user.toPublicProfile()
  );
});

/**
 * @desc    Delete profile image
 * @route   DELETE /api/v1/users/profile/image
 * @access  Private
 */
const deleteProfileImage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (!user.profileImage?.fileId) {
    throw ApiError.badRequest("No profile image to delete");
  }

  // Delete from ImageKit
  await imagekitService.deleteImage(user.profileImage.fileId);

  // Clear from user
  user.profileImage = undefined;
  await user.save();

  ApiResponse.success(
    res,
    "Profile image deleted successfully",
    user.toPublicProfile()
  );
});

/**
 * @desc    Update device info (FCM token, etc.)
 * @route   PUT /api/v1/users/device
 * @access  Private
 */
const updateDeviceInfo = asyncHandler(async (req, res) => {
  const { deviceId, deviceType, fcmToken } = req.body;

  const user = await User.findByIdAndUpdate(
    req.userId,
    {
      $set: {
        deviceInfo: sanitizeObject({ deviceId, deviceType, fcmToken }),
      },
    },
    { new: true }
  );

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  ApiResponse.success(res, "Device info updated successfully");
});

/**
 * @desc    Delete user account
 * @route   DELETE /api/v1/users/account
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Soft delete - just deactivate
  user.isActive = false;
  user.refreshToken = null;
  await user.save();

  ApiResponse.success(res, "Account deleted successfully");
});

module.exports = {
  getProfile,
  updateProfile,
  updateProfileImage,
  deleteProfileImage,
  updateDeviceInfo,
  deleteAccount,
};
