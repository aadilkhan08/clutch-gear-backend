/**
 * Notification Routes
 * Customer notification endpoints
 */
const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/notification.controller");
const { authenticate } = require("../middlewares");

// All routes require authentication
router.use(authenticate);

// @route   GET /api/v1/notifications
// @desc    Get customer notifications
router.get("/", getNotifications);

// @route   GET /api/v1/notifications/unread-count
// @desc    Get unread notification count
router.get("/unread-count", getUnreadCount);

// @route   GET /api/v1/notifications/preferences
// @desc    Get notification preferences
router.get("/preferences", getPreferences);

// @route   PUT /api/v1/notifications/preferences
// @desc    Update notification preferences
router.put("/preferences", updatePreferences);

// @route   PUT /api/v1/notifications/mark-read
// @desc    Mark specific notifications as read
router.put("/mark-read", markAsRead);

// @route   PUT /api/v1/notifications/mark-all-read
// @desc    Mark all notifications as read
router.put("/mark-all-read", markAllAsRead);

// @route   POST /api/v1/notifications/register-token
// @desc    Register FCM token for push notifications
router.post("/register-token", registerToken);

// @route   DELETE /api/v1/notifications/register-token
// @desc    Unregister FCM token (on logout)
router.delete("/register-token", unregisterToken);

// @route   GET /api/v1/notifications/:id
// @desc    Get single notification
router.get("/:id", getNotification);

// @route   DELETE /api/v1/notifications/:id
// @desc    Delete a notification
router.delete("/:id", deleteNotification);

// @route   POST /api/v1/notifications/test
// @desc    Send a test push notification to current user
router.post("/test", require("../controllers/notification.controller").sendTestNotification);

module.exports = router;
