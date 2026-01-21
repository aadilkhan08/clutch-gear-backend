/**
 * Package Controller
 * Admin package management operations
 */
const { Package, Subscription, Service } = require("../models");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

/**
 * @desc    Get all packages (Admin)
 * @route   GET /api/v1/admin/packages
 * @access  Private/Admin
 */
const getAllPackages = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const { type, isActive, search } = req.query;

  // Build query
  const query = {};
  if (type) query.type = type;
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const [packages, total] = await Promise.all([
    Package.find(query)
      .populate("services.service", "name category basePrice")
      .sort(sort || { displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Package.countDocuments(query),
  ]);

  return ApiResponse.paginated(
    res,
    "Packages retrieved successfully",
    packages,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get available packages for customers
 * @route   GET /api/v1/packages
 * @access  Public
 */
const getAvailablePackages = asyncHandler(async (req, res) => {
  const { type, vehicleType } = req.query;

  const query = { isActive: true };
  if (type) query.type = type;
  if (vehicleType) {
    query.vehicleTypes = { $in: [vehicleType, "all"] };
  }

  // Check validity dates
  const now = new Date();
  query.$or = [
    { validFrom: { $exists: false } },
    { validFrom: null },
    { validFrom: { $lte: now } },
  ];
  query.$and = [
    {
      $or: [
        { validUntil: { $exists: false } },
        { validUntil: null },
        { validUntil: { $gte: now } },
      ],
    },
  ];

  const packages = await Package.find(query)
    .populate("services.service", "name category basePrice estimatedDuration")
    .sort({ isRecommended: -1, isPopular: -1, displayOrder: 1 });

  return ApiResponse.success(res, "Available packages retrieved", packages);
});

/**
 * @desc    Get package by ID
 * @route   GET /api/v1/packages/:id
 * @access  Public
 */
const getPackageById = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id).populate(
    "services.service",
    "name category basePrice estimatedDuration description image"
  );

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  return ApiResponse.success(res, "Package retrieved successfully", pkg);
});

/**
 * @desc    Create package (Admin)
 * @route   POST /api/v1/admin/packages
 * @access  Private/Admin
 */
const createPackage = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    type,
    vehicleTypes,
    duration,
    services,
    features,
    inclusions,
    exclusions,
    price,
    originalPrice,
    discountPercent,
    taxRate,
    image,
    isPopular,
    isRecommended,
    displayOrder,
    termsAndConditions,
    validFrom,
    validUntil,
    maxSubscriptions,
  } = req.body;

  // Validate services exist
  if (services && services.length > 0) {
    const serviceIds = services.map((s) => s.service);
    const existingServices = await Service.find({ _id: { $in: serviceIds } });
    if (existingServices.length !== serviceIds.length) {
      throw new ApiError(400, "One or more services not found");
    }
  }

  const pkg = await Package.create({
    name,
    description,
    type,
    vehicleTypes,
    duration,
    services,
    features,
    inclusions,
    exclusions,
    price,
    originalPrice,
    discountPercent,
    taxRate,
    image,
    isPopular,
    isRecommended,
    displayOrder,
    termsAndConditions,
    validFrom,
    validUntil,
    maxSubscriptions,
  });

  await pkg.populate("services.service", "name category basePrice");

  return ApiResponse.created(res, "Package created successfully", pkg);
});

/**
 * @desc    Update package (Admin)
 * @route   PUT /api/v1/admin/packages/:id
 * @access  Private/Admin
 */
const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  // Validate services if provided
  if (req.body.services && req.body.services.length > 0) {
    const serviceIds = req.body.services.map((s) => s.service);
    const existingServices = await Service.find({ _id: { $in: serviceIds } });
    if (existingServices.length !== serviceIds.length) {
      throw new ApiError(400, "One or more services not found");
    }
  }

  // Update allowed fields
  const allowedFields = [
    "name",
    "description",
    "type",
    "vehicleTypes",
    "duration",
    "services",
    "features",
    "inclusions",
    "exclusions",
    "price",
    "originalPrice",
    "discountPercent",
    "taxRate",
    "image",
    "isPopular",
    "isRecommended",
    "isActive",
    "displayOrder",
    "termsAndConditions",
    "validFrom",
    "validUntil",
    "maxSubscriptions",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      pkg[field] = req.body[field];
    }
  });

  await pkg.save();
  await pkg.populate("services.service", "name category basePrice");

  return ApiResponse.success(res, "Package updated successfully", pkg);
});

/**
 * @desc    Toggle package active status (Admin)
 * @route   PUT /api/v1/admin/packages/:id/toggle-status
 * @access  Private/Admin
 */
const togglePackageStatus = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  pkg.isActive = !pkg.isActive;
  await pkg.save();

  return ApiResponse.success(
    res,
    `Package ${pkg.isActive ? "activated" : "deactivated"} successfully`,
    pkg
  );
});

/**
 * @desc    Delete package (hard delete)
 * @route   DELETE /api/v1/admin/packages/:id
 * @access  Private/Admin
 */
const deletePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  // Check for active subscriptions
  const activeSubscriptions = await Subscription.countDocuments({
    package: pkg._id,
    status: "active",
  });

  if (activeSubscriptions > 0) {
    throw new ApiError(
      400,
      `Cannot delete package with ${activeSubscriptions} active subscription(s). Deactivate instead.`
    );
  }

  await Package.findByIdAndDelete(pkg._id);

  return ApiResponse.success(res, "Package deleted successfully", null);
});

/**
 * @desc    Get package statistics (Admin)
 * @route   GET /api/v1/admin/packages/stats
 * @access  Private/Admin
 */
const getPackageStats = asyncHandler(async (req, res) => {
  const [
    totalPackages,
    activePackages,
    totalSubscriptions,
    activeSubscriptions,
    revenueByPackage,
    subscriptionsByStatus,
  ] = await Promise.all([
    Package.countDocuments(),
    Package.countDocuments({ isActive: true }),
    Subscription.countDocuments(),
    Subscription.countDocuments({ status: "active" }),
    Subscription.aggregate([
      { $match: { "payment.paidAt": { $exists: true } } },
      {
        $group: {
          _id: "$package",
          totalRevenue: { $sum: "$payment.amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "_id",
          foreignField: "_id",
          as: "packageInfo",
        },
      },
      { $unwind: "$packageInfo" },
      {
        $project: {
          packageName: "$packageInfo.name",
          packageCode: "$packageInfo.code",
          totalRevenue: 1,
          count: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]),
    Subscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Format subscriptions by status
  const statusCounts = {};
  subscriptionsByStatus.forEach((item) => {
    statusCounts[item._id] = item.count;
  });

  return ApiResponse.success(res, "Package statistics retrieved", {
    totalPackages,
    activePackages,
    totalSubscriptions,
    activeSubscriptions,
    expiredSubscriptions: statusCounts.expired || 0,
    completedSubscriptions: statusCounts.completed || 0,
    cancelledSubscriptions: statusCounts.cancelled || 0,
    topPackagesByRevenue: revenueByPackage,
  });
});

module.exports = {
  getAllPackages,
  getAvailablePackages,
  getPackageById,
  createPackage,
  updatePackage,
  togglePackageStatus,
  deletePackage,
  getPackageStats,
};
