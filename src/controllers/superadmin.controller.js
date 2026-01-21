/**
 * Super Admin Controller
 * Super Admin-only operations: manage admins and view activity logs
 */
const { User, AdminActivity, Appointment, Payment } = require("../models");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

/**
 * @desc    List admins
 * @route   GET /api/v1/superadmin/admins
 * @access  Private/SuperAdmin
 */
const listAdmins = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [admins, total] = await Promise.all([
    User.find({ role: "admin" })
      .select("-refreshToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments({ role: "admin" }),
  ]);
  ApiResponse.paginated(
    res,
    "Admins fetched successfully",
    admins,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    List users (non-admin)
 * @route   GET /api/v1/superadmin/users
 * @access  Private/SuperAdmin
 */
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { search, isActive } = req.query;
  const query = { role: "user" };
  if (isActive !== undefined) query.isActive = isActive === "true";
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
 * @desc    Promote a user to admin
 * @route   POST /api/v1/superadmin/admins/promote
 * @access  Private/SuperAdmin
 */
const promoteToAdmin = asyncHandler(async (req, res) => {
  const { mobile, name, email } = req.body;
  if (!mobile) {
    throw ApiError.badRequest("Mobile is required");
  }
  let user = await User.findOne({ mobile });
  if (user) {
    if (user.role === "admin") {
      throw ApiError.conflict("User is already an admin");
    }
    user.role = "admin";
    user.name = name || user.name;
    user.email = email || user.email;
    await user.save();
  } else {
    user = await User.create({
      name,
      mobile,
      email,
      role: "admin",
      isVerified: true,
    });
  }
  await AdminActivity.create({
    actor: req.user._id,
    action: "promote-admin",
    targetUser: user._id,
    metadata: { mobile },
  });
  ApiResponse.success(res, "User promoted to admin successfully", user);
});

/**
 * @desc    Revoke admin access
 * @route   POST /api/v1/superadmin/admins/:id/revoke
 * @access  Private/SuperAdmin
 */
const revokeAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const admin = await User.findById(id);
  if (!admin) {
    throw ApiError.notFound("User not found");
  }
  if (admin.role !== "admin") {
    throw ApiError.badRequest("User is not an admin");
  }
  admin.role = "user";
  await admin.save();
  await AdminActivity.create({
    actor: req.user._id,
    action: "revoke-admin",
    targetUser: admin._id,
  });
  ApiResponse.success(res, "Admin access revoked successfully", admin);
});

/**
 * @desc    View admin activity logs
 * @route   GET /api/v1/superadmin/admins/activity
 * @access  Private/SuperAdmin
 */
const getAdminActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [logs, total] = await Promise.all([
    AdminActivity.find()
      .populate("actor", "name mobile")
      .populate("targetUser", "name mobile role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminActivity.countDocuments(),
  ]);
  ApiResponse.paginated(
    res,
    "Activity logs fetched successfully",
    logs,
    createPaginationMeta(total, page, limit)
  );
});

module.exports = {
  // Dashboards & analytics
  getDashboard: asyncHandler(async (req, res) => {
    const [totalAdmins, totalUsers, totalBookings, revenueAgg] =
      await Promise.all([
        User.countDocuments({ role: "admin", isActive: true }),
        User.countDocuments({ role: "user", isActive: true }),
        Appointment.countDocuments({}),
        Payment.aggregate([
          { $match: { status: "completed" } },
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
      ]);

    return ApiResponse.success(res, "Super Admin dashboard fetched", {
      stats: {
        totalAdmins,
        totalUsers,
        totalBookings,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
    });
  }),
  getRevenueAnalytics: asyncHandler(async (req, res) => {
    const period = req.query.period || "month";
    const { getDateRange } = require("../utils");
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
    return ApiResponse.success(res, "Revenue analytics fetched", {
      period,
      totalRevenue,
      data: revenueData,
    });
  }),
  listAdmins,
  listUsers,
  promoteToAdmin,
  revokeAdmin,
  getAdminActivity,
};
