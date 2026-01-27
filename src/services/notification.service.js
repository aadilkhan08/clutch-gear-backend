/**
 * Notification Service
 * Centralized notification management - handles both push and SMS
 */
const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const fcmService = require("./fcm.service");
const smsService = require("./sms.service");

/**
 * Send notification to a customer
 * Respects user preferences and sends via appropriate channels
 */
const sendNotification = async ({
  customerId,
  type,
  title,
  body,
  data = {},
  sendPush = true,
  sendSms = false,
  imageUrl = null,
  relatedEntity = null,
  metadata = null,
}) => {
  try {
    // Get user with preferences
    const user = await User.findById(customerId).lean();
    if (!user) {
      console.warn(`[Notification] User not found: ${customerId}`);
      return null;
    }

    const prefs = user.notificationPreferences || {};

    // Determine channels based on preferences
    const shouldSendPush = sendPush && prefs.pushEnabled !== false;
    const shouldSendSms = sendSms && prefs.smsEnabled !== false;

    // Check type-specific preferences
    const typePrefs = {
      BOOKING_CONFIRMATION: prefs.bookingAlerts !== false,
      STATUS_UPDATE: prefs.statusUpdates !== false,
      PAYMENT_ALERT: prefs.paymentAlerts !== false,
      SERVICE_REMINDER: prefs.remindersEnabled !== false,
      APPOINTMENT_REMINDER: prefs.remindersEnabled !== false,
      ESTIMATE_APPROVAL: prefs.statusUpdates !== false,
      VEHICLE_READY: prefs.statusUpdates !== false,
      GENERAL: true,
    };

    if (typePrefs[type] === false) {
      console.log(`[Notification] Skipped due to user preference: ${type}`);
      return null;
    }

    // Determine channel
    let channel = "PUSH";
    if (shouldSendPush && shouldSendSms) channel = "BOTH";
    else if (shouldSendSms && !shouldSendPush) channel = "SMS";

    // Create notification record
    const notification = await Notification.create({
      customer: customerId,
      type,
      channel,
      title,
      body,
      imageUrl,
      data: {
        screen: data.screen,
        params: data.params,
      },
      relatedEntity,
      metadata,
    });

    // Send push notification
    if (shouldSendPush && user.deviceInfo?.fcmToken) {
      try {
        const pushResult = await fcmService.sendToDevice(
          user.deviceInfo.fcmToken,
          { title, body, imageUrl },
          {
            type,
            notificationId: notification._id.toString(),
            screen: data.screen || "",
            ...Object.fromEntries(
              Object.entries(data.params || {}).map(([k, v]) => [k, String(v)])
            ),
          }
        );

        // Update push status
        notification.pushStatus = {
          sent: pushResult.success,
          sentAt: new Date(),
          error: pushResult.error,
          messageId: pushResult.messageId,
        };
        await notification.save();
      } catch (pushError) {
        console.error("[Notification] Push error:", pushError.message);
        notification.pushStatus = {
          sent: false,
          error: pushError.message,
        };
        await notification.save();
      }
    }

    // Send SMS
    if (shouldSendSms && user.mobile) {
      try {
        const smsResult = await smsService.sendSMS(user.mobile, body);
        notification.smsStatus = {
          sent: smsResult.success,
          sentAt: new Date(),
          provider: smsResult.provider,
        };
        await notification.save();
      } catch (smsError) {
        console.error("[Notification] SMS error:", smsError.message);
        notification.smsStatus = {
          sent: false,
          error: smsError.message,
        };
        await notification.save();
      }
    }

    return notification;
  } catch (error) {
    console.error("[Notification] Error:", error.message);
    throw error;
  }
};

/**
 * Send booking confirmation
 */
const sendBookingConfirmation = async (customerId, appointment) => {
  const date = new Date(appointment.scheduledDate).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return sendNotification({
    customerId,
    type: "BOOKING_CONFIRMATION",
    title: "Booking Confirmed! 🎉",
    body: `Your appointment ${appointment.appointmentNumber} is confirmed for ${date} at ${appointment.timeSlot}.`,
    data: {
      screen: "appointments/[id]",
      params: { id: appointment._id.toString() },
    },
    sendPush: true,
    sendSms: true,
    relatedEntity: { type: "appointment", id: appointment._id },
  });
};

/**
 * Send job status update
 */
const sendStatusUpdate = async (customerId, jobCard, newStatus) => {
  const statusMessages = {
    inspection: "Your vehicle is being inspected",
    "awaiting-approval": "Cost estimate is ready for your approval",
    approved: "Work has been approved and will begin shortly",
    "in-progress": "Work is in progress on your vehicle",
    "quality-check": "Your vehicle is undergoing quality check",
    ready: "Your vehicle is ready for pickup! 🎉",
    delivered: "Thank you for choosing us!",
    cancelled: "Your job has been cancelled",
  };

  const message = statusMessages[newStatus] || `Status updated to ${newStatus}`;

  return sendNotification({
    customerId,
    type: "STATUS_UPDATE",
    title: `Job ${jobCard.jobNumber} Update`,
    body: message,
    data: {
      screen: "jobcards/[id]",
      params: { id: jobCard._id.toString() },
    },
    sendPush: true,
    sendSms: newStatus === "ready" || newStatus === "awaiting-approval",
    relatedEntity: { type: "jobcard", id: jobCard._id },
  });
};

/**
 * Send estimate approval request
 */
const sendEstimateApproval = async (customerId, jobCard, estimatedAmount) => {
  return sendNotification({
    customerId,
    type: "ESTIMATE_APPROVAL",
    title: "Estimate Ready for Approval",
    body: `Estimated cost for your vehicle: ₹${estimatedAmount.toLocaleString("en-IN")}. Tap to review and approve.`,
    data: {
      screen: "jobcards/[id]",
      params: { id: jobCard._id.toString() },
    },
    sendPush: true,
    sendSms: true,
    relatedEntity: { type: "jobcard", id: jobCard._id },
  });
};

/**
 * Send payment success notification
 */
const sendPaymentSuccess = async (customerId, payment) => {
  return sendNotification({
    customerId,
    type: "PAYMENT_ALERT",
    title: "Payment Successful ✓",
    body: `Payment of ₹${payment.amount.toLocaleString("en-IN")} received. Thank you!`,
    data: {
      screen: "payments/[id]",
      params: { id: payment._id.toString() },
    },
    sendPush: true,
    sendSms: true,
    relatedEntity: { type: "payment", id: payment._id },
  });
};

/**
 * Send payment failure notification
 */
const sendPaymentFailure = async (customerId, amount, reason = "") => {
  return sendNotification({
    customerId,
    type: "PAYMENT_ALERT",
    title: "Payment Failed",
    body: `Payment of ₹${amount.toLocaleString("en-IN")} failed. ${reason}Please try again.`,
    data: {
      screen: "payments",
      params: {},
    },
    sendPush: true,
    sendSms: false,
  });
};

/**
 * Send vehicle ready notification
 */
const sendVehicleReady = async (customerId, jobCard) => {
  const vehicle = jobCard.vehicleSnapshot || {};
  return sendNotification({
    customerId,
    type: "VEHICLE_READY",
    title: "Vehicle Ready! 🚗",
    body: `Your ${vehicle.brand || ""} ${vehicle.model || ""} is ready for pickup.`,
    data: {
      screen: "jobcards/[id]",
      params: { id: jobCard._id.toString() },
    },
    sendPush: true,
    sendSms: true,
    relatedEntity: { type: "jobcard", id: jobCard._id },
  });
};

/**
 * Send appointment reminder
 */
const sendAppointmentReminder = async (customerId, appointment, hoursUntil) => {
  const date = new Date(appointment.scheduledDate).toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timeLabel = hoursUntil <= 2 ? "soon" : hoursUntil <= 24 ? "tomorrow" : `on ${date}`;

  return sendNotification({
    customerId,
    type: "APPOINTMENT_REMINDER",
    title: "Appointment Reminder 📅",
    body: `Your service appointment is ${timeLabel} at ${appointment.timeSlot}. See you there!`,
    data: {
      screen: "appointments/[id]",
      params: { id: appointment._id.toString() },
    },
    sendPush: true,
    sendSms: hoursUntil <= 24,
    relatedEntity: { type: "appointment", id: appointment._id },
  });
};

/**
 * Send service reminder (upcoming scheduled service)
 */
const sendServiceReminder = async (customerId, serviceSchedule, vehicle) => {
  const dueDate = new Date(serviceSchedule.nextServiceDate).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });

  return sendNotification({
    customerId,
    type: "SERVICE_REMINDER",
    title: "Service Due Soon 🔧",
    body: `${vehicle.brand || ""} ${vehicle.model || ""} (${vehicle.vehicleNumber}) service is due on ${dueDate}.`,
    data: {
      screen: "service-schedules",
      params: { vehicleId: vehicle._id.toString() },
    },
    sendPush: true,
    sendSms: false,
    relatedEntity: { type: "vehicle", id: vehicle._id },
  });
};

/**
 * Check for duplicate notification
 */
const isDuplicateNotification = async (customerId, type, relatedEntityId, withinMinutes = 5) => {
  const cutoff = new Date();
  cutoff.setMinutes(cutoff.getMinutes() - withinMinutes);

  const existing = await Notification.findOne({
    customer: customerId,
    type,
    "relatedEntity.id": relatedEntityId,
    createdAt: { $gte: cutoff },
  });

  return !!existing;
};

module.exports = {
  sendNotification,
  sendBookingConfirmation,
  sendStatusUpdate,
  sendEstimateApproval,
  sendPaymentSuccess,
  sendPaymentFailure,
  sendVehicleReady,
  sendAppointmentReminder,
  sendServiceReminder,
  isDuplicateNotification,
};
