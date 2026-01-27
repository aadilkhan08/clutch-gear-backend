/**
 * Notification Model
 * Stores notification records for customers
 */
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        "BOOKING_CONFIRMATION",
        "STATUS_UPDATE",
        "PAYMENT_ALERT",
        "SERVICE_REMINDER",
        "ESTIMATE_APPROVAL",
        "VEHICLE_READY",
        "APPOINTMENT_REMINDER",
        "GENERAL",
      ],
      required: true,
    },

    // Channel used for delivery
    channel: {
      type: String,
      enum: ["PUSH", "SMS", "BOTH"],
      required: true,
    },

    // Notification content
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      maxlength: 500,
    },

    // Optional image URL
    imageUrl: String,

    // Deep link data
    data: {
      screen: String, // Target screen for deep linking
      params: mongoose.Schema.Types.Mixed, // Parameters for navigation
    },

    // Delivery status per channel
    pushStatus: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      delivered: { type: Boolean, default: false },
      deliveredAt: Date,
      error: String,
      messageId: String,
    },
    smsStatus: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String,
      provider: String,
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,

    // Reference to related entity
    relatedEntity: {
      type: { type: String, enum: ["appointment", "jobcard", "payment", "invoice", "vehicle"] },
      id: mongoose.Schema.Types.ObjectId,
    },

    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ customer: 1, createdAt: -1 });
notificationSchema.index({ customer: 1, isRead: 1 });
notificationSchema.index({ customer: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });

/**
 * Get customer notifications with pagination
 */
notificationSchema.statics.getCustomerNotifications = async function (
  customerId,
  options = {}
) {
  const { page = 1, limit = 20, unreadOnly = false, type } = options;

  const query = { customer: customerId };
  if (unreadOnly) query.isRead = false;
  if (type) query.type = type;

  const [notifications, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get unread count for customer
 */
notificationSchema.statics.getUnreadCount = async function (customerId) {
  return this.countDocuments({ customer: customerId, isRead: false });
};

/**
 * Mark notifications as read
 */
notificationSchema.statics.markAsRead = async function (customerId, notificationIds) {
  const query = { customer: customerId };
  if (notificationIds && notificationIds.length > 0) {
    query._id = { $in: notificationIds };
  }

  return this.updateMany(query, {
    $set: { isRead: true, readAt: new Date() },
  });
};

/**
 * Mark all as read for customer
 */
notificationSchema.statics.markAllAsRead = async function (customerId) {
  return this.updateMany(
    { customer: customerId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

/**
 * Create and send notification
 */
notificationSchema.statics.createAndSend = async function (notificationData) {
  const notification = await this.create(notificationData);
  return notification;
};

/**
 * Delete old notifications (for cleanup cron)
 */
notificationSchema.statics.deleteOldNotifications = async function (daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });
};

module.exports = mongoose.model("Notification", notificationSchema);
