/**
 * FCM (Firebase Cloud Messaging) Service
 * Push notification management
 */
const config = require("../config");

// Try to load firebase-admin (optional dependency)
let admin = null;
try {
  admin = require("firebase-admin");
} catch (err) {
  console.warn(
    "firebase-admin not installed. Push notifications will be mocked."
  );
}

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized || !admin) return;

  try {
    if (config.firebase?.serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(config.firebase.serviceAccount),
      });
      firebaseInitialized = true;
      console.log("Firebase Admin SDK initialized successfully");
    } else {
      console.warn(
        "Firebase service account not configured. Push notifications disabled."
      );
    }
  } catch (error) {
    console.error("Failed to initialize Firebase:", error.message);
  }
};

// Initialize on module load
initializeFirebase();

/**
 * Send push notification to a single device
 * @param {string} fcmToken - Device FCM token
 * @param {object} notification - { title, body, imageUrl? }
 * @param {object} data - Custom data payload
 */
const sendToDevice = async (fcmToken, notification, data = {}) => {
  if (!firebaseInitialized) {
    console.log("[FCM Mock] sendToDevice:", { fcmToken, notification, data });
    return { success: true, mock: true };
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("[FCM] Message sent successfully:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("[FCM] Error sending message:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} fcmTokens - Array of FCM tokens
 * @param {object} notification - { title, body, imageUrl? }
 * @param {object} data - Custom data payload
 */
const sendToMultipleDevices = async (fcmTokens, notification, data = {}) => {
  if (!firebaseInitialized) {
    console.log("[FCM Mock] sendToMultipleDevices:", {
      count: fcmTokens.length,
      notification,
      data,
    });
    return { success: true, mock: true, successCount: fcmTokens.length };
  }

  if (!fcmTokens || fcmTokens.length === 0) {
    return { success: false, error: "No tokens provided" };
  }

  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: {
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
          },
        },
      },
      tokens: fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `[FCM] Multicast: ${response.successCount} success, ${response.failureCount} failed`
    );

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };
  } catch (error) {
    console.error("[FCM] Error sending multicast:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification by topic
 * @param {string} topic - Topic name
 * @param {object} notification - { title, body }
 * @param {object} data - Custom data payload
 */
const sendToTopic = async (topic, notification, data = {}) => {
  if (!firebaseInitialized) {
    console.log("[FCM Mock] sendToTopic:", { topic, notification, data });
    return { success: true, mock: true };
  }

  try {
    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    };

    const response = await admin.messaging().send(message);
    console.log("[FCM] Topic message sent:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("[FCM] Error sending to topic:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe tokens to a topic
 * @param {string[]} tokens - FCM tokens
 * @param {string} topic - Topic name
 */
const subscribeToTopic = async (tokens, topic) => {
  if (!firebaseInitialized) {
    console.log("[FCM Mock] subscribeToTopic:", { tokens, topic });
    return { success: true, mock: true };
  }

  try {
    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    console.log("[FCM] Subscribed to topic:", response);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("[FCM] Error subscribing to topic:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe tokens from a topic
 * @param {string[]} tokens - FCM tokens
 * @param {string} topic - Topic name
 */
const unsubscribeFromTopic = async (tokens, topic) => {
  if (!firebaseInitialized) {
    console.log("[FCM Mock] unsubscribeFromTopic:", { tokens, topic });
    return { success: true, mock: true };
  }

  try {
    const response = await admin
      .messaging()
      .unsubscribeFromTopic(tokens, topic);
    console.log("[FCM] Unsubscribed from topic:", response);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("[FCM] Error unsubscribing from topic:", error.message);
    return { success: false, error: error.message };
  }
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
      body: `New booking for ${
        appointment.vehicleSnapshot?.brand || "Vehicle"
      }`,
    },
    {
      type: "NEW_APPOINTMENT",
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
};
