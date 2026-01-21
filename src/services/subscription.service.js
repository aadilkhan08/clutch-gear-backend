/**
 * Subscription Cron Service
 * Handles automated subscription tasks like expiry checks and notifications
 */
const cron = require("node-cron");
const { Subscription, Package } = require("../models");
const fcmService = require("./fcm.service");

/**
 * Check and expire subscriptions that have passed their end date
 */
const expireSubscriptions = async () => {
  console.log("[Cron] Running subscription expiry check...");
  const now = new Date();

  try {
    const expiredSubs = await Subscription.find({
      status: "active",
      endDate: { $lt: now },
    }).populate("customer", "name fcmToken");

    let expiredCount = 0;

    for (const sub of expiredSubs) {
      sub.status = "expired";
      await sub.save();
      expiredCount++;

      // Send notification
      if (sub.customer && sub.customer.fcmToken) {
        try {
          await fcmService.sendToUser(sub.customer._id, {
            title: "Subscription Expired",
            body: "Your service subscription has expired. Renew to continue enjoying benefits!",
            data: {
              type: "subscription_expired",
              subscriptionId: sub._id.toString(),
            },
          });
        } catch (notifError) {
          console.error(
            `[Cron] Failed to notify ${sub.customer.name}:`,
            notifError.message
          );
        }
      }
    }

    console.log(`[Cron] Expired ${expiredCount} subscription(s)`);
    return expiredCount;
  } catch (error) {
    console.error("[Cron] Error in expiry check:", error);
    throw error;
  }
};

/**
 * Send reminder notifications for subscriptions expiring soon
 */
const sendExpiryReminders = async () => {
  console.log("[Cron] Sending expiry reminders...");
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Find subscriptions expiring in 3 days
    const expiringSoon = await Subscription.find({
      status: "active",
      endDate: { $gte: now, $lte: threeDaysLater },
    })
      .populate("customer", "name fcmToken")
      .populate("package", "name");

    // Find subscriptions expiring in 7 days
    const expiringWeek = await Subscription.find({
      status: "active",
      endDate: { $gt: threeDaysLater, $lte: sevenDaysLater },
    })
      .populate("customer", "name fcmToken")
      .populate("package", "name");

    let remindersSent = 0;

    // 3-day warnings
    for (const sub of expiringSoon) {
      const daysLeft = Math.ceil((sub.endDate - now) / (1000 * 60 * 60 * 24));
      try {
        await fcmService.sendToUser(sub.customer._id, {
          title: "Subscription Expiring Soon! ⚠️",
          body: `Your ${sub.package.name} subscription expires in ${daysLeft} day(s). Renew now to avoid interruption.`,
          data: {
            type: "subscription_expiry_warning",
            subscriptionId: sub._id.toString(),
            daysLeft: daysLeft.toString(),
          },
        });
        remindersSent++;
      } catch (error) {
        console.error(
          `[Cron] Failed to send 3-day reminder to ${sub.customer.name}:`,
          error.message
        );
      }
    }

    // 7-day reminders
    for (const sub of expiringWeek) {
      const daysLeft = Math.ceil((sub.endDate - now) / (1000 * 60 * 60 * 24));
      try {
        await fcmService.sendToUser(sub.customer._id, {
          title: "Subscription Renewal Reminder",
          body: `Your ${sub.package.name} subscription will expire in ${daysLeft} days. Consider renewing early!`,
          data: {
            type: "subscription_expiry_reminder",
            subscriptionId: sub._id.toString(),
            daysLeft: daysLeft.toString(),
          },
        });
        remindersSent++;
      } catch (error) {
        console.error(
          `[Cron] Failed to send 7-day reminder to ${sub.customer.name}:`,
          error.message
        );
      }
    }

    console.log(`[Cron] Sent ${remindersSent} expiry reminder(s)`);
    return remindersSent;
  } catch (error) {
    console.error("[Cron] Error sending reminders:", error);
    throw error;
  }
};

/**
 * Initialize cron jobs for subscription management
 */
const initCronJobs = () => {
  // Run expiry check every hour
  cron.schedule("0 * * * *", () => {
    expireSubscriptions().catch(console.error);
  });

  // Send expiry reminders daily at 9 AM
  cron.schedule("0 9 * * *", () => {
    sendExpiryReminders().catch(console.error);
  });

  console.log("[Cron] Subscription cron jobs initialized");
};

module.exports = {
  expireSubscriptions,
  sendExpiryReminders,
  initCronJobs,
};
