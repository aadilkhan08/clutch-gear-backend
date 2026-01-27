/**
 * Notification Scheduler
 * Cron jobs for sending reminders and scheduled notifications
 */
const cron = require("node-cron");
const { Appointment, ServiceSchedule, Vehicle, User } = require("../models");
const notificationService = require("./notification.service");

/**
 * Send appointment reminders for upcoming appointments
 * Runs every hour, sends reminders 24 hours and 2 hours before
 */
const scheduleAppointmentReminders = () => {
  // Run every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    console.log("[Scheduler] Running appointment reminder job...");

    try {
      const now = new Date();

      // 24-hour reminder window (23-25 hours from now)
      const reminder24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const reminder24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      // 2-hour reminder window (1-3 hours from now)
      const reminder2hStart = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      const reminder2hEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // Find appointments needing 24-hour reminder
      const appointments24h = await Appointment.find({
        scheduledDate: { $gte: reminder24hStart, $lte: reminder24hEnd },
        status: { $in: ["pending", "confirmed"] },
        "reminders.sent24h": { $ne: true },
      }).populate("customer", "_id mobile notificationPreferences deviceInfo");

      for (const appointment of appointments24h) {
        if (!appointment.customer) continue;

        try {
          // Check for duplicate
          const isDuplicate = await notificationService.isDuplicateNotification(
            appointment.customer._id,
            "APPOINTMENT_REMINDER",
            appointment._id,
            60 // 1 hour window
          );

          if (!isDuplicate) {
            await notificationService.sendAppointmentReminder(
              appointment.customer._id,
              appointment,
              24
            );

            // Mark reminder as sent
            await Appointment.updateOne(
              { _id: appointment._id },
              { $set: { "reminders.sent24h": true, "reminders.sent24hAt": new Date() } }
            );
          }
        } catch (error) {
          console.error(`[Scheduler] Failed to send 24h reminder for ${appointment._id}:`, error.message);
        }
      }

      // Find appointments needing 2-hour reminder
      const appointments2h = await Appointment.find({
        scheduledDate: { $gte: reminder2hStart, $lte: reminder2hEnd },
        status: { $in: ["pending", "confirmed"] },
        "reminders.sent2h": { $ne: true },
      }).populate("customer", "_id mobile notificationPreferences deviceInfo");

      for (const appointment of appointments2h) {
        if (!appointment.customer) continue;

        try {
          const isDuplicate = await notificationService.isDuplicateNotification(
            appointment.customer._id,
            "APPOINTMENT_REMINDER",
            appointment._id,
            30 // 30 min window
          );

          if (!isDuplicate) {
            await notificationService.sendAppointmentReminder(
              appointment.customer._id,
              appointment,
              2
            );

            await Appointment.updateOne(
              { _id: appointment._id },
              { $set: { "reminders.sent2h": true, "reminders.sent2hAt": new Date() } }
            );
          }
        } catch (error) {
          console.error(`[Scheduler] Failed to send 2h reminder for ${appointment._id}:`, error.message);
        }
      }

      console.log(`[Scheduler] Appointment reminders: ${appointments24h.length} (24h), ${appointments2h.length} (2h)`);
    } catch (error) {
      console.error("[Scheduler] Appointment reminder job failed:", error);
    }
  });
};

/**
 * Send service due reminders
 * Runs daily at 9 AM, sends reminders for services due in next 7 days
 */
const scheduleServiceReminders = () => {
  // Run daily at 9 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("[Scheduler] Running service reminder job...");

    try {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Find service schedules due in next 7 days that haven't been reminded
      const schedules = await ServiceSchedule.find({
        nextServiceDate: { $gte: now, $lte: weekFromNow },
        status: "active",
        lastReminderSentAt: {
          $not: {
            $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Not reminded in last 7 days
          },
        },
      })
        .populate("vehicle", "_id vehicleNumber brand model owner")
        .populate({
          path: "vehicle",
          populate: {
            path: "owner",
            select: "_id notificationPreferences deviceInfo",
          },
        });

      let sentCount = 0;

      for (const schedule of schedules) {
        if (!schedule.vehicle?.owner) continue;

        try {
          const isDuplicate = await notificationService.isDuplicateNotification(
            schedule.vehicle.owner._id,
            "SERVICE_REMINDER",
            schedule.vehicle._id,
            24 * 60 // 24 hour window
          );

          if (!isDuplicate) {
            await notificationService.sendServiceReminder(
              schedule.vehicle.owner._id,
              schedule,
              schedule.vehicle
            );

            // Update last reminder sent
            await ServiceSchedule.updateOne(
              { _id: schedule._id },
              { $set: { lastReminderSentAt: new Date() } }
            );

            sentCount++;
          }
        } catch (error) {
          console.error(`[Scheduler] Failed to send service reminder for ${schedule._id}:`, error.message);
        }
      }

      console.log(`[Scheduler] Service reminders sent: ${sentCount}`);
    } catch (error) {
      console.error("[Scheduler] Service reminder job failed:", error);
    }
  });
};

/**
 * Clean up old notifications
 * Runs daily at midnight, deletes read notifications older than 90 days
 */
const scheduleNotificationCleanup = () => {
  // Run daily at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("[Scheduler] Running notification cleanup job...");

    try {
      const Notification = require("../models/notification.model");
      const result = await Notification.deleteOldNotifications(90);
      console.log(`[Scheduler] Cleaned up ${result.deletedCount || 0} old notifications`);
    } catch (error) {
      console.error("[Scheduler] Notification cleanup failed:", error);
    }
  });
};

/**
 * Initialize all scheduled jobs
 */
const initializeScheduler = () => {
  console.log("[Scheduler] Initializing notification scheduler...");

  scheduleAppointmentReminders();
  scheduleServiceReminders();
  scheduleNotificationCleanup();

  console.log("[Scheduler] All jobs scheduled");
};

module.exports = {
  initializeScheduler,
  scheduleAppointmentReminders,
  scheduleServiceReminders,
  scheduleNotificationCleanup,
};
