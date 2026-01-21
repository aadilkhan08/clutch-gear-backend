/**
 * Service Schedule Controller
 */
const { ServiceSchedule, User, Vehicle } = require("../models");

const addFrequency = (date, frequency) => {
  const d = new Date(date);
  switch (frequency) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      break;
  }
  return d;
};

const getEffectiveDateField = (scheduleType) =>
  scheduleType === "PERIODIC" ? "nextServiceDate" : "scheduledDate";

exports.getDashboard = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const baseFilter = { isActive: true, status: "PENDING" };
    const todayFilter = {
      ...baseFilter,
      $or: [
        {
          scheduleType: "ONE_TIME",
          scheduledDate: { $gte: startOfDay, $lte: endOfDay },
        },
        {
          scheduleType: "PERIODIC",
          nextServiceDate: { $gte: startOfDay, $lte: endOfDay },
        },
      ],
    };

    const upcomingFilter = {
      ...baseFilter,
      $or: [
        { scheduleType: "ONE_TIME", scheduledDate: { $gt: endOfDay } },
        { scheduleType: "PERIODIC", nextServiceDate: { $gt: endOfDay } },
      ],
    };

    const overdueFilter = {
      ...baseFilter,
      $or: [
        { scheduleType: "ONE_TIME", scheduledDate: { $lt: startOfDay } },
        { scheduleType: "PERIODIC", nextServiceDate: { $lt: startOfDay } },
      ],
    };

    const [todayCount, upcomingCount, overdueCount] = await Promise.all([
      ServiceSchedule.countDocuments(todayFilter),
      ServiceSchedule.countDocuments(upcomingFilter),
      ServiceSchedule.countDocuments(overdueFilter),
    ]);

    res.json({
      success: true,
      message: "Service schedule dashboard fetched",
      data: {
        todayCount,
        upcomingCount,
        overdueCount,
      },
    });
  } catch (error) {
    console.error("Service schedule dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
      error: error.message,
    });
  }
};

exports.listSchedules = async (req, res) => {
  try {
    const {
      status,
      customerId,
      vehicleId,
      scheduleType,
      frequency,
      date,
      from,
      to,
      type,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { isActive: true };
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (vehicleId) filter.vehicleId = vehicleId;
    if (scheduleType) filter.scheduleType = scheduleType;
    if (frequency) filter.frequency = frequency;

    const start = date ? new Date(date) : from ? new Date(from) : null;
    const end = date ? new Date(date) : to ? new Date(to) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    if (start && end) {
      filter.$or = [
        { scheduleType: "ONE_TIME", scheduledDate: { $gte: start, $lte: end } },
        {
          scheduleType: "PERIODIC",
          nextServiceDate: { $gte: start, $lte: end },
        },
      ];
    }

    if (type === "overdue") {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      filter.status = "PENDING";
      filter.$or = [
        { scheduleType: "ONE_TIME", scheduledDate: { $lt: startOfDay } },
        { scheduleType: "PERIODIC", nextServiceDate: { $lt: startOfDay } },
      ];
    }

    if (type === "today") {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      filter.status = "PENDING";
      filter.$or = [
        {
          scheduleType: "ONE_TIME",
          scheduledDate: { $gte: startOfDay, $lte: endOfDay },
        },
        {
          scheduleType: "PERIODIC",
          nextServiceDate: { $gte: startOfDay, $lte: endOfDay },
        },
      ];
    }

    if (type === "upcoming") {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      filter.status = "PENDING";
      filter.$or = [
        { scheduleType: "ONE_TIME", scheduledDate: { $gt: endOfDay } },
        { scheduleType: "PERIODIC", nextServiceDate: { $gt: endOfDay } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [items, total] = await Promise.all([
      ServiceSchedule.find(filter)
        .populate("customerId", "name mobile")
        .populate("vehicleId", "vehicleNumber brand model")
        .sort({ nextServiceDate: 1, scheduledDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ServiceSchedule.countDocuments(filter),
    ]);

    res.json({
      success: true,
      message: "Service schedules fetched",
      data: {
        schedules: items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("List schedules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch schedules",
      error: error.message,
    });
  }
};

exports.getScheduleById = async (req, res) => {
  try {
    const schedule = await ServiceSchedule.findById(req.params.id)
      .populate("customerId", "name mobile")
      .populate("vehicleId", "vehicleNumber brand model")
      .lean();

    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    res.json({
      success: true,
      message: "Schedule fetched",
      data: { schedule },
    });
  } catch (error) {
    console.error("Get schedule error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch schedule",
        error: error.message,
      });
  }
};

exports.createSchedule = async (req, res) => {
  try {
    const {
      customerId,
      vehicleId,
      serviceType,
      scheduleType,
      frequency,
      scheduledDate,
      remarks,
    } = req.body;

    const customer = await User.findById(customerId);
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found" });
    }

    const baseDate = new Date(scheduledDate);
    const nextServiceDate = scheduleType === "PERIODIC" ? baseDate : null;

    const schedule = await ServiceSchedule.create({
      customerId,
      vehicleId,
      serviceType,
      scheduleType,
      frequency: scheduleType === "PERIODIC" ? frequency : undefined,
      scheduledDate: baseDate,
      nextServiceDate,
      status: "PENDING",
      remarks,
      createdBy: req.user._id,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Service schedule created",
      data: { schedule },
    });
  } catch (error) {
    console.error("Create schedule error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create schedule",
        error: error.message,
      });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await ServiceSchedule.findById(req.params.id);
    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    if (schedule.status === "COMPLETED") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Completed schedules cannot be edited",
        });
    }

    const {
      serviceType,
      scheduleType,
      frequency,
      scheduledDate,
      remarks,
      status,
      isActive,
    } = req.body;

    if (serviceType !== undefined) schedule.serviceType = serviceType;
    if (remarks !== undefined) schedule.remarks = remarks;
    if (isActive !== undefined) schedule.isActive = isActive;

    if (scheduleType && scheduleType !== schedule.scheduleType) {
      schedule.scheduleType = scheduleType;
    }

    if (frequency !== undefined) schedule.frequency = frequency;

    if (scheduledDate) {
      const baseDate = new Date(scheduledDate);
      schedule.scheduledDate = baseDate;
      if (schedule.scheduleType === "PERIODIC") {
        schedule.nextServiceDate = baseDate;
      }
    }

    if (status && schedule.status !== status) {
      schedule.status = status;
    }

    await schedule.save();

    res.json({
      success: true,
      message: "Schedule updated",
      data: { schedule },
    });
  } catch (error) {
    console.error("Update schedule error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update schedule",
        error: error.message,
      });
  }
};

exports.markCompleted = async (req, res) => {
  try {
    const schedule = await ServiceSchedule.findById(req.params.id);
    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    if (
      schedule.status === "COMPLETED" &&
      schedule.scheduleType === "ONE_TIME"
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Schedule already completed" });
    }

    const effectiveDate =
      schedule.scheduleType === "PERIODIC"
        ? schedule.nextServiceDate || schedule.scheduledDate
        : schedule.scheduledDate;

    schedule.history = schedule.history || [];
    schedule.history.push({
      date: effectiveDate,
      completedAt: new Date(),
      remarks: req.body?.remarks || schedule.remarks,
    });

    if (schedule.scheduleType === "PERIODIC") {
      schedule.nextServiceDate = addFrequency(
        effectiveDate,
        schedule.frequency
      );
      schedule.status = "PENDING";
    } else {
      schedule.status = "COMPLETED";
      schedule.nextServiceDate = null;
    }

    await schedule.save();

    res.json({
      success: true,
      message: "Schedule completed",
      data: { schedule },
    });
  } catch (error) {
    console.error("Mark completed error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to mark completed",
        error: error.message,
      });
  }
};

exports.listMySchedules = async (req, res) => {
  try {
    const { status, type } = req.query;
    const filter = { customerId: req.userId, isActive: true };
    if (status) filter.status = status;

    if (type === "upcoming") {
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      filter.$or = [
        { scheduleType: "ONE_TIME", scheduledDate: { $gt: endOfDay } },
        { scheduleType: "PERIODIC", nextServiceDate: { $gt: endOfDay } },
      ];
    }

    const schedules = await ServiceSchedule.find(filter)
      .populate("vehicleId", "vehicleNumber brand model")
      .sort({ nextServiceDate: 1, scheduledDate: 1 })
      .lean();

    res.json({
      success: true,
      message: "Schedules fetched",
      data: { schedules },
    });
  } catch (error) {
    console.error("List my schedules error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch schedules",
        error: error.message,
      });
  }
};
