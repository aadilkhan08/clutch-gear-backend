/**
 * Appointment Controller
 * Handles appointment booking and management
 */
const { Appointment, Vehicle, Service, TimeSlot, User } = require("../models");
const { smsService, fcmService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

/**
 * @desc    Get user appointments
 * @route   GET /api/v1/appointments
 * @access  Private
 */
const getAppointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const query = { customer: req.userId };
  if (status) {
    query.status = status;
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate("vehicle", "vehicleNumber brand model")
      .populate("services.service", "name basePrice")
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Appointments fetched successfully",
    appointments,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get single appointment
 * @route   GET /api/v1/appointments/:id
 * @access  Private
 */
const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    _id: req.params.id,
    customer: req.userId,
  })
    .populate("vehicle")
    .populate("services.service");

  if (!appointment) {
    throw ApiError.notFound("Appointment not found");
  }

  ApiResponse.success(res, "Appointment fetched successfully", appointment);
});

/**
 * @desc    Create appointment
 * @route   POST /api/v1/appointments
 * @access  Private
 */
const createAppointment = asyncHandler(async (req, res) => {
  const {
    vehicleId,
    services,
    scheduledDate,
    timeSlot,
    customerNotes,
    pickupRequired,
    pickupAddress,
  } = req.body;

  // Verify vehicle belongs to user
  const vehicle = await Vehicle.findOne({
    _id: vehicleId,
    owner: req.userId,
    isActive: true,
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  // Get service details and calculate price
  const serviceIds = services.map((s) => s.serviceId);
  const serviceDetails = await Service.find({
    _id: { $in: serviceIds },
    isActive: true,
  });

  if (serviceDetails.length !== serviceIds.length) {
    throw ApiError.badRequest("One or more services not found");
  }

  const appointmentServices = serviceDetails.map((service) => ({
    service: service._id,
    price: service.basePrice,
  }));

  // Check slot availability
  const existingBookings = await Appointment.countDocuments({
    scheduledDate: {
      $gte: new Date(scheduledDate).setHours(0, 0, 0, 0),
      $lt: new Date(scheduledDate).setHours(23, 59, 59, 999),
    },
    "timeSlot.startTime": timeSlot.startTime,
    status: { $nin: ["cancelled", "no-show"] },
  });

  // Check max bookings (default 5)
  const dayOfWeek = new Date(scheduledDate).getDay();
  const slot = await TimeSlot.findOne({
    dayOfWeek,
    startTime: timeSlot.startTime,
    isActive: true,
  });

  const maxBookings = slot?.maxBookings || 5;
  if (existingBookings >= maxBookings) {
    throw ApiError.badRequest("This time slot is fully booked");
  }

  // Create appointment
  const appointment = await Appointment.create({
    customer: req.userId,
    vehicle: vehicleId,
    services: appointmentServices,
    scheduledDate,
    timeSlot,
    customerNotes,
    pickupRequired,
    pickupAddress: pickupRequired ? pickupAddress : undefined,
    estimatedCost: appointmentServices.reduce((sum, s) => sum + s.price, 0),
  });

  await appointment.populate([
    { path: "vehicle", select: "vehicleNumber brand model" },
    { path: "services.service", select: "name" },
  ]);

  // Notify admins about new appointment
  try {
    const admins = await User.find({ role: "admin", isActive: true })
      .select("deviceInfo")
      .lean();
    const adminTokens = admins
      .filter((a) => a.deviceInfo?.fcmToken)
      .map((a) => a.deviceInfo.fcmToken);
    if (adminTokens.length > 0) {
      await fcmService.notifyNewAppointment(adminTokens, appointment);
    }
  } catch (error) {
    console.error("Push notification to admins failed:", error);
  }

  ApiResponse.created(res, "Appointment booked successfully", appointment);
});

/**
 * @desc    Cancel appointment
 * @route   PUT /api/v1/appointments/:id/cancel
 * @access  Private
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const appointment = await Appointment.findOne({
    _id: req.params.id,
    customer: req.userId,
    status: { $in: ["pending", "confirmed"] },
  });

  if (!appointment) {
    throw ApiError.notFound("Appointment not found or cannot be cancelled");
  }

  appointment.status = "cancelled";
  appointment.cancelledBy = "customer";
  appointment.cancellationReason = reason;
  appointment.cancelledAt = new Date();
  await appointment.save();

  ApiResponse.success(res, "Appointment cancelled successfully", appointment);
});

/**
 * @desc    Get available time slots
 * @route   GET /api/v1/appointments/slots
 * @access  Private
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { date } = req.query;

  if (!date) {
    throw ApiError.badRequest("Date is required");
  }

  const selectedDate = new Date(date);
  const dayOfWeek = selectedDate.getDay();

  // Get slots for this day
  const slots = await TimeSlot.find({
    dayOfWeek,
    isActive: true,
  }).sort({ startTime: 1 });

  // Get existing bookings count for each slot
  const bookingsCount = await Appointment.aggregate([
    {
      $match: {
        scheduledDate: {
          $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
          $lt: new Date(selectedDate.setHours(23, 59, 59, 999)),
        },
        status: { $nin: ["cancelled", "no-show"] },
      },
    },
    {
      $group: {
        _id: "$timeSlot.startTime",
        count: { $sum: 1 },
      },
    },
  ]);

  const bookingsMap = {};
  bookingsCount.forEach((b) => {
    bookingsMap[b._id] = b.count;
  });

  // Add availability to slots
  const availableSlots = slots.map((slot) => ({
    ...slot.toJSON(),
    bookedCount: bookingsMap[slot.startTime] || 0,
    available: (bookingsMap[slot.startTime] || 0) < slot.maxBookings,
    spotsLeft: slot.maxBookings - (bookingsMap[slot.startTime] || 0),
  }));

  ApiResponse.success(
    res,
    "Available slots fetched successfully",
    availableSlots
  );
});

/**
 * @desc    Get upcoming appointments
 * @route   GET /api/v1/appointments/upcoming
 * @access  Private
 */
const getUpcomingAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({
    customer: req.userId,
    scheduledDate: { $gte: new Date() },
    status: { $in: ["pending", "confirmed"] },
  })
    .populate("vehicle", "vehicleNumber brand model")
    .populate("services.service", "name")
    .sort({ scheduledDate: 1 })
    .limit(5)
    .lean();

  ApiResponse.success(
    res,
    "Upcoming appointments fetched successfully",
    appointments
  );
});

// ============ Admin Controllers ============

/**
 * @desc    Get all appointments (Admin)
 * @route   GET /api/v1/admin/appointments
 * @access  Private/Admin
 */
const getAllAppointments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, date, customerId } = req.query;

  const query = {};
  if (status) query.status = status;
  if (customerId) query.customer = customerId;
  if (date) {
    const selectedDate = new Date(date);
    query.scheduledDate = {
      $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
      $lt: new Date(selectedDate.setHours(23, 59, 59, 999)),
    };
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate("customer", "name mobile")
      .populate("vehicle", "vehicleNumber brand model")
      .populate("services.service", "name basePrice")
      .sort({ scheduledDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Appointment.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Appointments fetched successfully",
    appointments,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Update appointment status (Admin)
 * @route   PUT /api/v1/admin/appointments/:id
 * @access  Private/Admin
 */
const updateAppointment = asyncHandler(async (req, res) => {
  const { status, adminNotes, scheduledDate, timeSlot } = req.body;

  const appointment = await Appointment.findById(req.params.id)
    .populate("customer", "mobile")
    .populate("vehicle", "vehicleNumber");

  if (!appointment) {
    throw ApiError.notFound("Appointment not found");
  }

  if (status) {
    appointment.status = status;
    if (status === "confirmed") {
      appointment.confirmedAt = new Date();
      // Send confirmation SMS
      try {
        await smsService.sendAppointmentConfirmation(
          appointment.customer.mobile,
          {
            appointmentNumber: appointment.appointmentNumber,
            date: new Date(appointment.scheduledDate).toLocaleDateString(),
            time: appointment.timeSlot.startTime,
            vehicleNumber: appointment.vehicle.vehicleNumber,
          }
        );
      } catch (error) {
        console.error("SMS notification failed:", error);
      }
    }
    if (status === "completed") {
      appointment.completedAt = new Date();
    }
    if (status === "cancelled") {
      appointment.cancelledBy = "admin";
      appointment.cancelledAt = new Date();
    }
  }

  if (adminNotes) appointment.adminNotes = adminNotes;
  if (scheduledDate) appointment.scheduledDate = scheduledDate;
  if (timeSlot) appointment.timeSlot = timeSlot;

  await appointment.save();

  ApiResponse.success(res, "Appointment updated successfully", appointment);
});

/**
 * @desc    Get today's appointments (Admin)
 * @route   GET /api/v1/admin/appointments/today
 * @access  Private/Admin
 */
const getTodayAppointments = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const appointments = await Appointment.find({
    scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    status: { $nin: ["cancelled", "no-show"] },
  })
    .populate("customer", "name mobile")
    .populate("vehicle", "vehicleNumber brand model")
    .populate("services.service", "name")
    .sort({ "timeSlot.startTime": 1 })
    .lean();

  ApiResponse.success(
    res,
    "Today's appointments fetched successfully",
    appointments
  );
});

module.exports = {
  // User
  getAppointments,
  getAppointment,
  createAppointment,
  cancelAppointment,
  getAvailableSlots,
  getUpcomingAppointments,
  // Admin
  getAllAppointments,
  updateAppointment,
  getTodayAppointments,
};
