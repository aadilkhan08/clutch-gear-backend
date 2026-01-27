/**
 * Service Controller
 * Handles workshop services management
 */
const NodeCache = require("node-cache");
const { Service } = require("../models");
const { imagekitService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
  parseFilters,
} = require("../utils");

const SERVICE_CACHE_TTL_SECONDS = 300;
const serviceCache = new NodeCache({
  stdTTL: SERVICE_CACHE_TTL_SECONDS,
  checkperiod: 60,
  useClones: false,
});

const SERVICE_LIST_FIELDS =
  "name description category vehicleTypes basePrice estimatedDuration image isPopular displayOrder";

const buildCacheKey = (prefix, payload) =>
  `${prefix}:${JSON.stringify(payload)}`;

/**
 * @desc    Get all services (public)
 * @route   GET /api/v1/services
 * @access  Public
 */
const getServices = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { category, vehicleType, search } = req.query;

  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  if (vehicleType) {
    query.$or = [{ vehicleTypes: vehicleType }, { vehicleTypes: "all" }];
  }

  if (search) {
    query.$text = { $search: search };
  }

  const cacheKey = buildCacheKey("services:list", {
    page,
    limit,
    category: category || null,
    vehicleType: vehicleType || null,
    search: search || null,
  });
  const cached = serviceCache.get(cacheKey);
  if (cached) {
    return ApiResponse.paginated(
      res,
      "Services fetched successfully",
      cached.services,
      createPaginationMeta(cached.total, page, limit)
    );
  }

  const [services, total] = await Promise.all([
    Service.find(query)
      .select(SERVICE_LIST_FIELDS)
      .sort({ isPopular: -1, displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Service.countDocuments(query),
  ]);

  serviceCache.set(cacheKey, { services, total });

  ApiResponse.paginated(
    res,
    "Services fetched successfully",
    services,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get all services (admin)
 * @route   GET /api/v1/services/admin/list
 * @access  Private/Admin
 */
const getServicesAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { category, vehicleType, search, isActive } = req.query;

  const query = {};

  if (typeof isActive !== "undefined") {
    query.isActive = String(isActive) === "true";
  }

  if (category) {
    query.category = category;
  }

  if (vehicleType) {
    query.$or = [{ vehicleTypes: vehicleType }, { vehicleTypes: "all" }];
  }

  if (search) {
    query.$text = { $search: search };
  }

  const [services, total] = await Promise.all([
    Service.find(query)
      .sort({ isActive: -1, isPopular: -1, displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Service.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Services fetched successfully",
    services,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get popular services
 * @route   GET /api/v1/services/popular
 * @access  Public
 */
const getPopularServices = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 6;

  const cacheKey = buildCacheKey("services:popular", { limit });
  const cached = serviceCache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(
      res,
      "Popular services fetched successfully",
      cached
    );
  }

  const services = await Service.find({
    isActive: true,
    isPopular: true,
  })
    .select(SERVICE_LIST_FIELDS)
    .sort({ displayOrder: 1 })
    .limit(limit)
    .lean();

  serviceCache.set(cacheKey, services);

  ApiResponse.success(res, "Popular services fetched successfully", services);
});

/**
 * @desc    Get services by category
 * @route   GET /api/v1/services/category/:category
 * @access  Public
 */
const getServicesByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { page, limit, skip } = parsePagination(req.query);

  const query = { isActive: true, category };

  const cacheKey = buildCacheKey("services:category", {
    category,
    page,
    limit,
  });
  const cached = serviceCache.get(cacheKey);
  if (cached) {
    return ApiResponse.paginated(
      res,
      "Services fetched successfully",
      cached.services,
      createPaginationMeta(cached.total, page, limit)
    );
  }

  const [services, total] = await Promise.all([
    Service.find(query)
      .select(SERVICE_LIST_FIELDS)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Service.countDocuments(query),
  ]);

  serviceCache.set(cacheKey, { services, total });

  ApiResponse.paginated(
    res,
    "Services fetched successfully",
    services,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get single service
 * @route   GET /api/v1/services/:id
 * @access  Public
 */
const getService = asyncHandler(async (req, res) => {
  const isAdmin = ["admin", "superadmin"].includes(req.userRole);

  const cacheKey = buildCacheKey("services:detail", {
    id: req.params.id,
    scope: isAdmin ? "admin" : "customer",
  });
  const cached = serviceCache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(res, "Service fetched successfully", cached);
  }

  const service = await Service.findById(req.params.id).select("-__v").lean();

  if (!service || (!service.isActive && !isAdmin)) {
    throw ApiError.notFound("Service not found");
  }

  serviceCache.set(cacheKey, service);

  ApiResponse.success(res, "Service fetched successfully", service);
});

/**
 * @desc    Create service (Admin only)
 * @route   POST /api/v1/services
 * @access  Private/Admin
 */
const createService = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    vehicleTypes,
    basePrice,
    estimatedDuration,
    inclusions,
    exclusions,
    isPopular,
    displayOrder,
  } = req.body;

  const service = await Service.create({
    name,
    description,
    category,
    vehicleTypes,
    basePrice,
    estimatedDuration,
    inclusions,
    exclusions,
    isPopular,
    displayOrder,
  });

  serviceCache.flushAll();

  ApiResponse.created(res, "Service created successfully", service);
});

/**
 * @desc    Update service (Admin only)
 * @route   PUT /api/v1/services/:id
 * @access  Private/Admin
 */
const updateService = asyncHandler(async (req, res) => {
  const allowedUpdates = [
    "name",
    "description",
    "category",
    "vehicleTypes",
    "basePrice",
    "estimatedDuration",
    "inclusions",
    "exclusions",
    "isPopular",
    "isActive",
    "displayOrder",
  ];

  const updateData = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!service) {
    throw ApiError.notFound("Service not found");
  }

  serviceCache.flushAll();

  ApiResponse.success(res, "Service updated successfully", service);
});

/**
 * @desc    Update service image (Admin only)
 * @route   PUT /api/v1/services/:id/image
 * @access  Private/Admin
 */
const updateServiceImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please upload an image");
  }

  const service = await Service.findById(req.params.id);

  if (!service) {
    throw ApiError.notFound("Service not found");
  }

  // Delete old image
  if (service.image?.fileId) {
    try {
      await imagekitService.deleteImage(service.image.fileId);
    } catch (error) {
      console.error("Failed to delete old image:", error);
    }
  }

  // Upload new image
  const uploadResult = await imagekitService.uploadImage(
    req.file.buffer,
    `service_${service._id}`,
    "services"
  );

  service.image = {
    url: uploadResult.url,
    fileId: uploadResult.fileId,
  };
  await service.save();

  serviceCache.flushAll();

  ApiResponse.success(res, "Service image updated successfully", {
    image: service.image,
  });
});

/**
 * @desc    Delete service (Admin only)
 * @route   DELETE /api/v1/services/:id
 * @access  Private/Admin
 */
const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!service) {
    throw ApiError.notFound("Service not found");
  }

  serviceCache.flushAll();

  ApiResponse.success(res, "Service deleted successfully");
});

/**
 * @desc    Get service categories
 * @route   GET /api/v1/services/categories/list
 * @access  Public
 */
const getCategories = asyncHandler(async (req, res) => {
  const cacheKey = "services:categories";
  const cached = serviceCache.get(cacheKey);
  if (cached) {
    return ApiResponse.success(res, "Categories fetched successfully", cached);
  }

  const categories = await Service.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  serviceCache.set(cacheKey, categories);

  ApiResponse.success(res, "Categories fetched successfully", categories);
});

module.exports = {
  getServices,
  getServicesAdmin,
  getPopularServices,
  getServicesByCategory,
  getService,
  createService,
  updateService,
  updateServiceImage,
  deleteService,
  getCategories,
};
