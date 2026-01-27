/**
 * Notification Controller
 * Customer notification endpoints
 */
const { Notification, User } = require("../models");
const { asyncHandler, ApiResponse, ApiError } = require("../utils");

/**
 * @desc    Get customer notifications
 * @route   GET /api/v1/notifications
 * @access  Private/Customer
 */
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly, type } = req.query;

  const result = await Notification.getCustomerNotifications(req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    unreadOnly: unreadOnly === "true",
    type,
  });

  ApiResponse.success(res, "Notifications retrieved", result.notifications, {
    pagination: result.pagination,
  });
});

/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private/Customer
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.getUnreadCount(req.user._id);
  ApiResponse.success(res, "Unread count retrieved", { count });
});

/**
 * @desc    Mark notifications as read
 * @route   PUT /api/v1/notifications/mark-read
 * @access  Private/Customer
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { notificationIds } = req.body;

  if (notificationIds && !Array.isArray(notificationIds)) {
    throw ApiError.badRequest("notificationIds must be an array");
  }

  await Notification.markAsRead(req.user._id, notificationIds);

  ApiResponse.success(res, "Notifications marked as read");
});

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/mark-all-read
 * @access  Private/Customer
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.markAllAsRead(req.user._id);
  ApiResponse.success(res, "All notifications marked as read");
});

/**
 * @desc    Get single notification
 * @route   GET /api/v1/notifications/:id
 * @access  Private/Customer
 */
const getNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    customer: req.user._id,
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  // Mark as read
  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  ApiResponse.success(res, "Notification retrieved", notification);
});

/**
 * @desc    Delete a notification
 * @route   DELETE /api/v1/notifications/:id
 * @access  Private/Customer
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    customer: req.user._id,
  });

  if (!notification) {
    throw ApiError.notFound("Notification not found");
  }

  ApiResponse.success(res, "Notification deleted");
});

/**
 * @desc    Get notification preferences
 * @route   GET /api/v1/notifications/preferences
 * @access  Private/Customer
 */
const getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("notificationPreferences");

  const preferences = user.notificationPreferences || {
    pushEnabled: true,
    smsEnabled: true,
    remindersEnabled: true,
    bookingAlerts: true,
    statusUpdates: true,
    paymentAlerts: true,
    promotions: false,
  };

  ApiResponse.success(res, "Preferences retrieved", preferences);
});

/**
 * @desc    Update notification preferences
 * @route   PUT /api/v1/notifications/preferences
 * @access  Private/Customer
 */
const updatePreferences = asyncHandler(async (req, res) => {
  const allowedFields = [
    "pushEnabled",
    "smsEnabled",
    "remindersEnabled",
    "bookingAlerts",
    "statusUpdates",
    "paymentAlerts",
    "promotions",
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (typeof req.body[field] === "boolean") {
      updates[`notificationPreferences.${field}`] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw ApiError.badRequest("No valid preference fields provided");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true }
  ).select("notificationPreferences");

  ApiResponse.success(res, "Preferences updated", user.notificationPreferences);
});

/**
 * @desc    Register FCM token
 * @route   POST /api/v1/notifications/register-token
 * @access  Private/Customer
 */
const registerToken = asyncHandler(async (req, res) => {
  const { fcmToken, deviceId, deviceType } = req.body;

  if (!fcmToken) {
    throw ApiError.badRequest("FCM token is required");
  }

  const updateData = {
    "deviceInfo.fcmToken": fcmToken,
    "deviceInfo.fcmTokenUpdatedAt": new Date(),
  };

  if (deviceId) updateData["deviceInfo.deviceId"] = deviceId;
  if (deviceType) updateData["deviceInfo.deviceType"] = deviceType;

  await User.findByIdAndUpdate(req.user._id, { $set: updateData });

  ApiResponse.success(res, "FCM token registered");
});

/**
 * @desc    Unregister FCM token (logout)
 * @route   DELETE /api/v1/notifications/register-token
 * @access  Private/Customer
 */
const unregisterToken = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: { "deviceInfo.fcmToken": 1 },
  });

  ApiResponse.success(res, "FCM token unregistered");
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getNotification,
  deleteNotification,
  getPreferences,
  updatePreferences,
  registerToken,
  unregisterToken,
};
