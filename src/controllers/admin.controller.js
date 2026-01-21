/**
 * Admin Controller
 * Admin-specific operations (Dashboard, Analytics, User Management)
 */
const {
  User,
  Vehicle,
  Appointment,
  JobCard,
  Payment,
  Review,
  Service,
} = require("../models");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
  getDateRange,
} = require("../utils");

/**
 * @desc    Get dashboard stats
 * @route   GET /api/v1/admin/dashboard
 * @access  Private/Admin
 */
const getDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const [
    totalUsers,
    totalVehicles,
    todayAppointments,
    activeJobCards,
    todayCollection,
    pendingApprovals,
    totalMechanics,
    jobCardsByStatus,
  ] = await Promise.all([
    User.countDocuments({ role: "user", isActive: true }),
    Vehicle.countDocuments({ isActive: true }),
    Appointment.countDocuments({
      scheduledDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ["cancelled", "no-show"] },
    }),
    JobCard.countDocuments({ status: { $nin: ["delivered", "cancelled"] } }),
    Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: ["$paymentType", "refund"] },
                { $multiply: ["$amount", -1] },
                "$amount",
              ],
            },
          },
        },
      },
    ]),
    JobCard.countDocuments({ status: "awaiting-approval" }),
    User.countDocuments({ role: "mechanic", isActive: true }),
    JobCard.aggregate([
      { $match: { status: { $nin: ["delivered", "cancelled"] } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Format job cards by status
  const statusCounts = {};
  jobCardsByStatus.forEach((s) => {
    statusCounts[s._id] = s.count;
  });

  ApiResponse.success(res, "Dashboard data fetched successfully", {
    stats: {
      totalUsers,
      totalVehicles,
      todayAppointments,
      activeJobCards,
      todayCollection: todayCollection[0]?.total || 0,
      pendingApprovals,
      totalMechanics,
    },
    jobCardsByStatus: statusCounts,
  });
});

/**
 * @desc    Get revenue analytics
 * @route   GET /api/v1/admin/analytics/revenue
 * @access  Private/Admin
 */
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { period = "month" } = req.query;
  const { start, end } = getDateRange(period);

  const revenueData = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: "completed",
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        revenue: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "refund"] },
              { $multiply: ["$amount", -1] },
              "$amount",
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ]);

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);

  ApiResponse.success(res, "Revenue analytics fetched successfully", {
    period,
    totalRevenue,
    data: revenueData,
  });
});

/**
 * @desc    Get service analytics
 * @route   GET /api/v1/admin/analytics/services
 * @access  Private/Admin
 */
const getServiceAnalytics = asyncHandler(async (req, res) => {
  const { period = "month" } = req.query;
  const { start, end } = getDateRange(period);

  const serviceStats = await JobCard.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    { $unwind: "$services" },
    {
      $lookup: {
        from: "services",
        localField: "services",
        foreignField: "_id",
        as: "serviceDetails",
      },
    },
    { $unwind: "$serviceDetails" },
    {
      $group: {
        _id: "$serviceDetails._id",
        name: { $first: "$serviceDetails.name" },
        category: { $first: "$serviceDetails.category" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  ApiResponse.success(res, "Service analytics fetched successfully", {
    period,
    topServices: serviceStats,
  });
});

/**
 * @desc    Get all users (Admin)
 * @route   GET /api/v1/admin/users
 * @access  Private/Admin
 */
const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, isActive, role } = req.query;

  const query = {};
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select("-refreshToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Users fetched successfully",
    users,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get user details (Admin)
 * @route   GET /api/v1/admin/users/:id
 * @access  Private/Admin
 */
const getUserDetails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-refreshToken");

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Get user stats
  const [vehicleCount, appointmentCount, jobCardCount, totalSpent] =
    await Promise.all([
      Vehicle.countDocuments({ owner: user._id, isActive: true }),
      Appointment.countDocuments({ customer: user._id }),
      JobCard.countDocuments({ customer: user._id }),
      Payment.aggregate([
        {
          $match: {
            customer: user._id,
            status: "completed",
            paymentType: { $ne: "refund" },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

  ApiResponse.success(res, "User details fetched successfully", {
    user,
    stats: {
      vehicleCount,
      appointmentCount,
      jobCardCount,
      totalSpent: totalSpent[0]?.total || 0,
    },
  });
});

/**
 * @desc    Update user status (Admin)
 * @route   PUT /api/v1/admin/users/:id/status
 * @access  Private/Admin
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.role === "admin") {
    throw ApiError.forbidden("Cannot modify admin status");
  }

  user.isActive = isActive;
  if (!isActive) {
    user.refreshToken = null;
  }
  await user.save();

  ApiResponse.success(
    res,
    `User ${isActive ? "activated" : "deactivated"} successfully`,
    user
  );
});

/**
 * @desc    Update user role (Admin) - only user <-> mechanic
 * @route   PUT /api/v1/admin/users/:id/role
 * @access  Private/Admin
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Admins cannot change admin/superadmin roles
  if (user.role === "admin" || user.role === "superadmin") {
    throw ApiError.forbidden("Cannot change role for admin/superadmin users");
  }

  // Only allow promoting/demoting mechanic
  if (role !== "user" && role !== "mechanic") {
    throw ApiError.badRequest("Invalid role");
  }

  user.role = role;
  await user.save();

  ApiResponse.success(res, "User role updated successfully", user);
});

/**
 * @desc    Get all customers (users with role 'user')
 * @route   GET /api/v1/admin/customers
 * @access  Private/Admin
 */
const getAllCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search } = req.query;

  const query = { role: "user", isActive: true };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [customers, total] = await Promise.all([
    User.find(query)
      .select("name mobile email avatar createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query),
  ]);

  // Add vehicle count and job card count for each customer
  const customerIds = customers.map((c) => c._id);

  const [vehicleCounts, jobCardCounts] = await Promise.all([
    Vehicle.aggregate([
      { $match: { owner: { $in: customerIds }, isActive: true } },
      { $group: { _id: "$owner", count: { $sum: 1 } } },
    ]),
    JobCard.aggregate([
      { $match: { customer: { $in: customerIds } } },
      { $group: { _id: "$customer", count: { $sum: 1 } } },
    ]),
  ]);

  const vehicleCountMap = {};
  vehicleCounts.forEach((v) => {
    vehicleCountMap[v._id.toString()] = v.count;
  });

  const jobCardCountMap = {};
  jobCardCounts.forEach((j) => {
    jobCardCountMap[j._id.toString()] = j.count;
  });

  const enrichedCustomers = customers.map((c) => ({
    ...c,
    vehicleCount: vehicleCountMap[c._id.toString()] || 0,
    totalJobCards: jobCardCountMap[c._id.toString()] || 0,
  }));

  ApiResponse.success(
    res,
    "Customers fetched successfully",
    enrichedCustomers,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    List mechanics (Admin)
 * @route   GET /api/v1/admin/mechanics
 * @access  Private/Admin
 */
const listMechanics = asyncHandler(async (req, res) => {
  const mechanics = await User.find({ role: "mechanic", isActive: true })
    .select("name mobile email role isActive isVerified")
    .sort({ createdAt: -1 })
    .lean();

  ApiResponse.success(res, "Mechanics fetched successfully", mechanics);
});

/**
 * @desc    Get mechanic details (Admin)
 * @route   GET /api/v1/admin/mechanics/:id
 * @access  Private/Admin
 */
const getMechanic = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const mechanic = await User.findOne({ _id: id, role: "mechanic" })
    .select(
      "name mobile email role isActive isVerified isProfileComplete profileImage address createdAt"
    )
    .lean();

  if (!mechanic) {
    throw ApiError.notFound("Mechanic not found");
  }

  ApiResponse.success(res, "Mechanic fetched successfully", mechanic);
});

/**
 * @desc    Create admin user (Admin)
 * @route   POST /api/v1/admin/users/admin
 * @access  Private/Admin
 */
const createAdminUser = asyncHandler(async (req, res) => {
  const { name, mobile, email } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ mobile });

  if (existingUser) {
    if (existingUser.role === "admin") {
      throw ApiError.conflict("Admin with this mobile already exists");
    }
    // Upgrade to admin
    existingUser.role = "admin";
    existingUser.name = name || existingUser.name;
    existingUser.email = email || existingUser.email;
    await existingUser.save();
    return ApiResponse.success(
      res,
      "User upgraded to admin successfully",
      existingUser
    );
  }

  const admin = await User.create({
    name,
    mobile,
    email,
    role: "admin",
    isVerified: true,
  });

  ApiResponse.created(res, "Admin user created successfully", admin);
});

/**
 * @desc    Get time slots (Admin)
 * @route   GET /api/v1/admin/timeslots
 * @access  Private/Admin
 */
const getTimeSlots = asyncHandler(async (req, res) => {
  const { TimeSlot } = require("../models");
  const slots = await TimeSlot.find().sort({ dayOfWeek: 1, startTime: 1 });
  ApiResponse.success(res, "Time slots fetched successfully", slots);
});

/**
 * @desc    Create/Update time slot (Admin)
 * @route   POST /api/v1/admin/timeslots
 * @access  Private/Admin
 */
const upsertTimeSlot = asyncHandler(async (req, res) => {
  const { TimeSlot } = require("../models");
  const { dayOfWeek, startTime, endTime, maxBookings, isActive } = req.body;

  const slot = await TimeSlot.findOneAndUpdate(
    { dayOfWeek, startTime },
    { dayOfWeek, startTime, endTime, maxBookings, isActive },
    { new: true, upsert: true, runValidators: true }
  );

  ApiResponse.success(res, "Time slot saved successfully", slot);
});

/**
 * @desc    Delete time slot (Admin)
 * @route   DELETE /api/v1/admin/timeslots/:id
 * @access  Private/Admin
 */
const deleteTimeSlot = asyncHandler(async (req, res) => {
  const { TimeSlot } = require("../models");
  const slot = await TimeSlot.findByIdAndDelete(req.params.id);

  if (!slot) {
    throw ApiError.notFound("Time slot not found");
  }

  ApiResponse.success(res, "Time slot deleted successfully");
});

/**
 * @desc    Create walk-in customer with optional vehicle
 * @route   POST /api/v1/admin/customers/walk-in
 * @access  Private/Admin
 */
const createWalkInCustomer = asyncHandler(async (req, res) => {
  const { mobile, name, email, address, vehicle } = req.body;

  // Check if user exists
  let user = await User.findOne({ mobile });

  if (user) {
    // User exists, update info if provided
    if (name && !user.name) user.name = name;
    if (email && !user.email) user.email = email;
    if (address) {
      user.address = { ...user.address, ...address };
    }
    await user.save();
  } else {
    // Create new user
    user = await User.create({
      mobile,
      name: name || `Customer ${mobile.slice(-4)}`,
      email,
      address,
      role: "user",
      isVerified: true, // Walk-in customers are verified by admin
      isProfileComplete: !!name,
    });
  }

  let createdVehicle = null;

  // Create vehicle if provided
  if (vehicle && vehicle.vehicleNumber) {
    // Check if vehicle already exists
    const existingVehicle = await Vehicle.findOne({
      owner: user._id,
      vehicleNumber: vehicle.vehicleNumber.toUpperCase(),
    });

    if (existingVehicle) {
      createdVehicle = existingVehicle;
    } else {
      createdVehicle = await Vehicle.create({
        owner: user._id,
        vehicleNumber: vehicle.vehicleNumber.toUpperCase(),
        vehicleType: vehicle.vehicleType || "car",
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        fuelType: vehicle.fuelType,
        color: vehicle.color,
      });
    }
  }

  ApiResponse.created(res, "Walk-in customer created successfully", {
    customer: user.toPublicProfile(),
    vehicle: createdVehicle,
  });
});

/**
 * @desc    Get customer's vehicles
 * @route   GET /api/v1/admin/customers/:id/vehicles
 * @access  Private/Admin
 */
const getCustomerVehicles = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await User.findById(id);
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  const vehicles = await Vehicle.find({ owner: id, isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  ApiResponse.success(res, "Customer vehicles fetched successfully", vehicles);
});

/**
 * @desc    Get customer's service history
 * @route   GET /api/v1/admin/customers/:id/history
 * @access  Private/Admin
 */
const getCustomerServiceHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, skip } = parsePagination(req.query);

  const customer = await User.findById(id);
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  const [jobCards, total] = await Promise.all([
    JobCard.find({ customer: id })
      .populate("vehicle", "vehicleNumber brand model")
      .populate("services", "name category")
      .select("jobNumber status vehicleSnapshot billing createdAt deliveredAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JobCard.countDocuments({ customer: id }),
  ]);

  // Calculate totals
  const totalSpent = await Payment.aggregate([
    {
      $match: {
        customer: customer._id,
        status: "completed",
        paymentType: { $ne: "refund" },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  ApiResponse.paginated(
    res,
    "Service history fetched successfully",
    {
      history: jobCards,
      summary: {
        totalJobCards: total,
        totalSpent: totalSpent[0]?.total || 0,
      },
    },
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get mechanic workload and productivity
 * @route   GET /api/v1/admin/mechanics/:id/workload
 * @access  Private/Admin
 */
const getMechanicWorkload = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { period = "month" } = req.query;
  const { start, end } = getDateRange(period);

  const mechanic = await User.findOne({ _id: id, role: "mechanic" });
  if (!mechanic) {
    throw ApiError.notFound("Mechanic not found");
  }

  // Current active jobs
  const activeJobs = await JobCard.find({
    assignedMechanicUserIds: id,
    status: { $nin: ["delivered", "cancelled"] },
  })
    .populate("vehicle", "vehicleNumber brand model")
    .select("jobNumber status vehicleSnapshot createdAt estimatedCompletion")
    .lean();

  // Completed jobs in period
  const completedJobs = await JobCard.countDocuments({
    assignedMechanicUserIds: id,
    status: "delivered",
    deliveredAt: { $gte: start, $lte: end },
  });

  // Average completion time
  const avgCompletionTime = await JobCard.aggregate([
    {
      $match: {
        assignedMechanicUserIds: mechanic._id,
        status: "delivered",
        deliveredAt: { $gte: start, $lte: end },
      },
    },
    {
      $project: {
        duration: {
          $divide: [
            { $subtract: ["$deliveredAt", "$receivedAt"] },
            1000 * 60 * 60, // Convert to hours
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgHours: { $avg: "$duration" },
      },
    },
  ]);

  // Jobs by status
  const jobsByStatus = await JobCard.aggregate([
    {
      $match: {
        assignedMechanicUserIds: mechanic._id,
        createdAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const statusCounts = {};
  jobsByStatus.forEach((s) => {
    statusCounts[s._id] = s.count;
  });

  ApiResponse.success(res, "Mechanic workload fetched successfully", {
    mechanic: {
      _id: mechanic._id,
      name: mechanic.name,
      mobile: mechanic.mobile,
    },
    activeJobs,
    stats: {
      activeJobCount: activeJobs.length,
      completedInPeriod: completedJobs,
      avgCompletionHours:
        Math.round((avgCompletionTime[0]?.avgHours || 0) * 10) / 10,
      jobsByStatus: statusCounts,
    },
    period,
  });
});

/**
 * @desc    Get all mechanics with workload summary
 * @route   GET /api/v1/admin/mechanics/workload
 * @access  Private/Admin
 */
const getAllMechanicsWorkload = asyncHandler(async (req, res) => {
  const mechanics = await User.find({ role: "mechanic", isActive: true })
    .select("name mobile profileImage")
    .lean();

  // Get active job counts for each mechanic
  const workloadData = await JobCard.aggregate([
    {
      $match: {
        status: { $nin: ["delivered", "cancelled"] },
      },
    },
    { $unwind: "$assignedMechanicUserIds" },
    {
      $group: {
        _id: "$assignedMechanicUserIds",
        activeJobs: { $sum: 1 },
        awaitingApproval: {
          $sum: { $cond: [{ $eq: ["$status", "awaiting-approval"] }, 1, 0] },
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
        },
      },
    },
  ]);

  // Map workload to mechanics
  const mechanicsWithWorkload = mechanics.map((m) => {
    const workload = workloadData.find(
      (w) => w._id.toString() === m._id.toString()
    ) || { activeJobs: 0, awaitingApproval: 0, inProgress: 0 };

    return {
      ...m,
      workload: {
        activeJobs: workload.activeJobs,
        awaitingApproval: workload.awaitingApproval,
        inProgress: workload.inProgress,
      },
    };
  });

  // Sort by active jobs (busiest first)
  mechanicsWithWorkload.sort(
    (a, b) => b.workload.activeJobs - a.workload.activeJobs
  );

  ApiResponse.success(
    res,
    "Mechanics workload fetched successfully",
    mechanicsWithWorkload
  );
});

/**
 * @desc    Add vehicle for a customer (Admin)
 * @route   POST /api/v1/admin/customers/:id/vehicles
 * @access  Private/Admin
 */
const addCustomerVehicle = asyncHandler(async (req, res) => {
  const { id: customerId } = req.params;
  const {
    vehicleNumber,
    vehicleType,
    brand,
    model,
    year,
    fuelType,
    color,
    engineNumber,
    chassisNumber,
  } = req.body;

  // Verify customer exists
  const customer = await User.findById(customerId);
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  // Check if vehicle already exists for this customer
  const existingVehicle = await Vehicle.findOne({
    owner: customerId,
    vehicleNumber: vehicleNumber.toUpperCase(),
  });

  if (existingVehicle) {
    if (existingVehicle.isActive) {
      throw ApiError.conflict("Vehicle already registered for this customer");
    }
    // Reactivate deleted vehicle
    existingVehicle.isActive = true;
    existingVehicle.vehicleType = vehicleType || existingVehicle.vehicleType;
    existingVehicle.brand = brand || existingVehicle.brand;
    existingVehicle.model = model || existingVehicle.model;
    existingVehicle.year = year || existingVehicle.year;
    existingVehicle.fuelType = fuelType || existingVehicle.fuelType;
    existingVehicle.color = color || existingVehicle.color;
    await existingVehicle.save();
    return ApiResponse.success(
      res,
      "Vehicle added successfully",
      existingVehicle
    );
  }

  const vehicle = await Vehicle.create({
    owner: customerId,
    vehicleNumber: vehicleNumber.toUpperCase(),
    vehicleType: vehicleType || "car",
    brand,
    model,
    year,
    fuelType: fuelType || "petrol",
    color,
    engineNumber,
    chassisNumber,
  });

  ApiResponse.created(res, "Vehicle added successfully", vehicle);
});

module.exports = {
  getDashboard,
  getRevenueAnalytics,
  getServiceAnalytics,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  updateUserRole,
  getAllCustomers,
  listMechanics,
  getMechanic,
  createAdminUser,
  getTimeSlots,
  upsertTimeSlot,
  deleteTimeSlot,
  // New endpoints
  createWalkInCustomer,
  getCustomerVehicles,
  getCustomerServiceHistory,
  getMechanicWorkload,
  getAllMechanicsWorkload,
  addCustomerVehicle,
};
