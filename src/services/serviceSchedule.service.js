/**
 * Service Schedule Cron Service
 */
const cron = require("node-cron");
const { ServiceSchedule, User } = require("../models");
const fcmService = require("./fcm.service");

const getDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const fetchAdminTokens = async () => {
  const admins = await User.find({ role: { $in: ["admin", "superadmin"] } })
    .select("deviceInfo.fcmToken")
    .lean();
  return admins.map((a) => a.deviceInfo?.fcmToken).filter(Boolean);
};

const getPendingSchedulesByRange = async (start, end) => {
  return ServiceSchedule.find({
    isActive: true,
    status: "PENDING",
    $or: [
      { scheduleType: "ONE_TIME", scheduledDate: { $gte: start, $lte: end } },
      { scheduleType: "PERIODIC", nextServiceDate: { $gte: start, $lte: end } },
    ],
  })
    .populate("customerId", "name deviceInfo")
    .populate("vehicleId", "vehicleNumber brand model")
    .lean();
};

const notifySchedules = async (schedules, title, dayLabel) => {
  let sent = 0;
  for (const schedule of schedules) {
    const customer = schedule.customerId;
    if (customer?.deviceInfo?.fcmToken) {
      await fcmService.sendToDevice(
        customer.deviceInfo.fcmToken,
        {
          title,
          body: `${schedule.serviceType} for ${
            schedule.vehicleId?.vehicleNumber || "vehicle"
          } is ${dayLabel}.`,
        },
        {
          type: "SERVICE_SCHEDULE_REMINDER",
          scheduleId: schedule._id.toString(),
        }
      );
      sent++;
    }
  }
  return sent;
};

const sendServiceReminders = async () => {
  console.log("[Cron] Sending service schedule reminders...");
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const { start: todayStart, end: todayEnd } = getDayRange(today);
  const { start: tomorrowStart, end: tomorrowEnd } = getDayRange(tomorrow);

  const [todaySchedules, tomorrowSchedules] = await Promise.all([
    getPendingSchedulesByRange(todayStart, todayEnd),
    getPendingSchedulesByRange(tomorrowStart, tomorrowEnd),
  ]);

  const [sentToday, sentTomorrow] = await Promise.all([
    notifySchedules(todaySchedules, "Service Due Today", "due today"),
    notifySchedules(tomorrowSchedules, "Service Reminder", "due tomorrow"),
  ]);

  const adminTokens = await fetchAdminTokens();
  if (adminTokens.length > 0) {
    await fcmService.sendToMultipleDevices(
      adminTokens,
      {
        title: "Service Schedules Pending",
        body: `Today: ${todaySchedules.length}, Tomorrow: ${tomorrowSchedules.length}`,
      },
      {
        type: "SERVICE_SCHEDULE_ADMIN_REMINDER",
      }
    );
  }

  console.log(
    `[Cron] Service reminders sent. Today: ${sentToday}, Tomorrow: ${sentTomorrow}`
  );
};

const initCronJobs = () => {
  // Daily at 9 AM
  cron.schedule("0 9 * * *", () => {
    sendServiceReminders().catch(console.error);
  });
  console.log("[Cron] Service schedule cron jobs initialized");
};

module.exports = {
  sendServiceReminders,
  initCronJobs,
};
