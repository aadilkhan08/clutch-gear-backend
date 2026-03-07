/**
 * Push Notification Service (Expo Push API)
 * Sends push notifications via Expo's push notification service.
 * Tokens stored as Expo Push Tokens (ExponentPushToken[xxx]).
 */
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

/**
 * Send push notification to a single device
 * @param {string} pushToken - Expo push token
 * @param {object} notification - { title, body, imageUrl? }
 * @param {object} data - Custom data payload
 */
const sendToDevice = async (pushToken, notification, data = {}) => {
  if (!pushToken) {
    console.warn("[Push] No push token provided");
    return { success: false, error: "No token" };
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(
      `[Push] Invalid Expo push token: ${pushToken?.substring(0, 30)}...`
    );
    return { success: false, error: "Invalid Expo push token" };
  }

  try {
    const message = {
      to: pushToken,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      priority: "high",
      channelId: "default",
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    const ticket = tickets[0];
    if (ticket.status === "ok") {
      console.log("[Push] Message sent successfully:", ticket.id);
      return { success: true, messageId: ticket.id };
    } else {
      console.error("[Push] Error in ticket:", ticket.message);
      return { success: false, error: ticket.message };
    }
  } catch (error) {
    console.error("[Push] Error sending message:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} pushTokens - Array of Expo push tokens
 * @param {object} notification - { title, body, imageUrl? }
 * @param {object} data - Custom data payload
 */
const sendToMultipleDevices = async (pushTokens, notification, data = {}) => {
  if (!pushTokens || pushTokens.length === 0) {
    return { success: false, error: "No tokens provided" };
  }

  // Filter to valid Expo push tokens only
  const validTokens = pushTokens.filter((t) => Expo.isExpoPushToken(t));
  if (validTokens.length === 0) {
    console.warn("[Push] No valid Expo push tokens in batch");
    return { success: false, error: "No valid tokens", successCount: 0, failureCount: pushTokens.length };
  }

  try {
    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      priority: "high",
      channelId: "default",
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    let successCount = 0;
    let failureCount = 0;
    for (const ticket of tickets) {
      if (ticket.status === "ok") {
        successCount++;
      } else {
        failureCount++;
        console.error("[Push] Ticket error:", ticket.message);
      }
    }

    console.log(
      `[Push] Multicast: ${successCount} success, ${failureCount} failed`
    );

    return {
      success: successCount > 0,
      successCount,
      failureCount: failureCount + (pushTokens.length - validTokens.length),
      responses: tickets,
    };
  } catch (error) {
    console.error("[Push] Error sending multicast:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification by topic (not supported by Expo – sends individually)
 * Kept for interface compatibility; callers should prefer sendToMultipleDevices.
 */
const sendToTopic = async (_topic, notification, data = {}) => {
  console.warn(
    "[Push] Topic-based sending not supported by Expo Push API. Use sendToMultipleDevices."
  );
  return { success: false, error: "Topics not supported with Expo Push" };
};

/**
 * Subscribe / unsubscribe stubs (not applicable for Expo Push)
 */
const subscribeToTopic = async (_tokens, _topic) => {
  console.warn("[Push] Topic subscriptions not supported by Expo Push API.");
  return { success: false, error: "Topics not supported" };
};

const unsubscribeFromTopic = async (_tokens, _topic) => {
  console.warn("[Push] Topic subscriptions not supported by Expo Push API.");
  return { success: false, error: "Topics not supported" };
};

// ============ Application-specific notification helpers ============

/**
 * Notify customer about job status update
 */
const notifyJobStatusUpdate = async (user, jobCard, newStatus) => {
  if (!user.deviceInfo?.fcmToken) return null;

  const statusMessages = {
    inspection: "Your vehicle is being inspected",
    "awaiting-approval": "Cost estimate ready for your approval",
    approved: "Work has been approved and will begin shortly",
    "in-progress": "Work is in progress on your vehicle",
    "quality-check": "Your vehicle is undergoing quality check",
    ready: "Your vehicle is ready for pickup!",
    delivered: "Thank you for choosing us!",
    cancelled: "Your job has been cancelled",
  };

  return sendToDevice(
    user.deviceInfo.fcmToken,
    {
      title: `Job ${jobCard.jobNumber} Update`,
      body: statusMessages[newStatus] || `Status updated to ${newStatus}`,
    },
    {
      type: "JOB_STATUS_UPDATE",
      jobCardId: jobCard._id.toString(),
      status: newStatus,
    }
  );
};

/**
 * Notify customer about cost estimate
 */
const notifyCostEstimate = async (user, jobCard, estimatedAmount) => {
  if (!user.deviceInfo?.fcmToken) return null;

  return sendToDevice(
    user.deviceInfo.fcmToken,
    {
      title: "Cost Estimate Ready",
      body: `Estimated cost for ${jobCard.vehicleSnapshot?.vehicleNumber}: ₹${estimatedAmount}. Tap to approve.`,
    },
    {
      type: "COST_ESTIMATE",
      jobCardId: jobCard._id.toString(),
      amount: estimatedAmount.toString(),
    }
  );
};

/**
 * Notify customer about vehicle ready for pickup
 */
const notifyVehicleReady = async (user, jobCard) => {
  if (!user.deviceInfo?.fcmToken) return null;

  return sendToDevice(
    user.deviceInfo.fcmToken,
    {
      title: "Vehicle Ready! 🎉",
      body: `Your ${jobCard.vehicleSnapshot?.brand} ${jobCard.vehicleSnapshot?.model} is ready for pickup.`,
    },
    {
      type: "VEHICLE_READY",
      jobCardId: jobCard._id.toString(),
    }
  );
};

/**
 * Notify mechanic about new job assignment
 */
const notifyMechanicAssignment = async (mechanic, jobCard) => {
  if (!mechanic.deviceInfo?.fcmToken) return null;

  return sendToDevice(
    mechanic.deviceInfo.fcmToken,
    {
      title: "New Job Assigned",
      body: `Job ${jobCard.jobNumber} - ${jobCard.vehicleSnapshot?.brand} ${jobCard.vehicleSnapshot?.model}`,
    },
    {
      type: "JOB_ASSIGNED",
      jobCardId: jobCard._id.toString(),
    }
  );
};

/**
 * Notify admin about customer approval
 */
const notifyAdminApproval = async (adminTokens, jobCard) => {
  if (!adminTokens || adminTokens.length === 0) return null;

  return sendToMultipleDevices(
    adminTokens,
    {
      title: "Customer Approved",
      body: `Job ${jobCard.jobNumber} approved. Work can begin.`,
    },
    {
      type: "JOB_APPROVED",
      jobCardId: jobCard._id.toString(),
    }
  );
};

/**
 * Notify about payment received
 */
const notifyPaymentReceived = async (user, payment) => {
  if (!user.deviceInfo?.fcmToken) return null;

  return sendToDevice(
    user.deviceInfo.fcmToken,
    {
      title: "Payment Confirmed",
      body: `Payment of ₹${payment.amount} received. Thank you!`,
    },
    {
      type: "PAYMENT_RECEIVED",
      paymentId: payment._id.toString(),
      amount: payment.amount.toString(),
    }
  );
};

/**
 * Notify about appointment reminder
 */
const notifyAppointmentReminder = async (user, appointment) => {
  if (!user.deviceInfo?.fcmToken) return null;

  const date = new Date(appointment.scheduledDate);
  const formattedDate = date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return sendToDevice(
    user.deviceInfo.fcmToken,
    {
      title: "Appointment Reminder",
      body: `Your service appointment is scheduled for ${formattedDate} at ${appointment.timeSlot}`,
    },
    {
      type: "APPOINTMENT_REMINDER",
      appointmentId: appointment._id.toString(),
    }
  );
};

/**
 * Notify admin about new appointment
 */
const notifyNewAppointment = async (adminTokens, appointment) => {
  if (!adminTokens || adminTokens.length === 0) return null;

  return sendToMultipleDevices(
    adminTokens,
    {
      title: "New Appointment",
      body: `New booking for ${appointment.vehicleSnapshot?.brand || "Vehicle"
        }`,
    },
    {
      type: "NEW_APPOINTMENT",
      appointmentId: appointment._id.toString(),
    }
  );
};

/**
 * Notify admin about rescheduled appointment
 */
const notifyAppointmentRescheduled = async (adminTokens, appointment, previousSchedule) => {
  if (!adminTokens || adminTokens.length === 0) return null;

  const prevDate = new Date(previousSchedule.date).toLocaleDateString("en-IN");
  const newDate = new Date(appointment.scheduledDate).toLocaleDateString("en-IN");

  return sendToMultipleDevices(
    adminTokens,
    {
      title: "Appointment Rescheduled",
      body: `Appointment ${appointment.appointmentNumber} rescheduled from ${prevDate} to ${newDate}`,
    },
    {
      type: "APPOINTMENT_RESCHEDULED",
      appointmentId: appointment._id.toString(),
    }
  );
};

module.exports = {
  sendToDevice,
  sendToMultipleDevices,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  // App-specific helpers
  notifyJobStatusUpdate,
  notifyCostEstimate,
  notifyVehicleReady,
  notifyMechanicAssignment,
  notifyAdminApproval,
  notifyPaymentReceived,
  notifyAppointmentReminder,
  notifyNewAppointment,
  notifyAppointmentRescheduled,
};
