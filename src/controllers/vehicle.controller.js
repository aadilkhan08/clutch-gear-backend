/**
 * Vehicle Controller
 * Handles vehicle CRUD operations
 */
const { Vehicle } = require("../models");
const { imagekitService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
  sanitizeObject,
} = require("../utils");

/**
 * @desc    Get user vehicles
 * @route   GET /api/v1/vehicles
 * @access  Private
 */
const getVehicles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const query = { owner: req.userId, isActive: true };

  const [vehicles, total] = await Promise.all([
    Vehicle.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Vehicle.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Vehicles fetched successfully",
    vehicles,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get single vehicle
 * @route   GET /api/v1/vehicles/:id
 * @access  Private
 */
const getVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findOne({
    _id: req.params.id,
    owner: req.userId,
    isActive: true,
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  ApiResponse.success(res, "Vehicle fetched successfully", vehicle);
});

/**
 * @desc    Add new vehicle
 * @route   POST /api/v1/vehicles
 * @access  Private
 */
const addVehicle = asyncHandler(async (req, res) => {
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
    insuranceExpiry,
    pucExpiry,
    notes,
  } = req.body;

  // Check if vehicle already exists for this user
  const existingVehicle = await Vehicle.findOne({
    owner: req.userId,
    vehicleNumber: vehicleNumber.toUpperCase(),
  });

  if (existingVehicle) {
    if (existingVehicle.isActive) {
      throw ApiError.conflict("Vehicle already registered");
    }
    // Reactivate deleted vehicle
    existingVehicle.isActive = true;
    existingVehicle.vehicleType = vehicleType;
    existingVehicle.brand = brand;
    existingVehicle.model = model;
    await existingVehicle.save();
    return ApiResponse.success(
      res,
      "Vehicle added successfully",
      existingVehicle
    );
  }

  const vehicle = await Vehicle.create({
    owner: req.userId,
    vehicleNumber: vehicleNumber.toUpperCase(),
    vehicleType,
    brand,
    model,
    year,
    fuelType,
    color,
    engineNumber,
    chassisNumber,
    insuranceExpiry,
    pucExpiry,
    notes,
  });

  ApiResponse.created(res, "Vehicle added successfully", vehicle);
});

/**
 * @desc    Update vehicle
 * @route   PUT /api/v1/vehicles/:id
 * @access  Private
 */
const updateVehicle = asyncHandler(async (req, res) => {
  const allowedUpdates = [
    "vehicleType",
    "brand",
    "model",
    "year",
    "fuelType",
    "color",
    "engineNumber",
    "chassisNumber",
    "insuranceExpiry",
    "pucExpiry",
    "notes",
  ];

  const updateData = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  });

  const vehicle = await Vehicle.findOneAndUpdate(
    {
      _id: req.params.id,
      owner: req.userId,
      isActive: true,
    },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  ApiResponse.success(res, "Vehicle updated successfully", vehicle);
});

/**
 * @desc    Delete vehicle (soft delete)
 * @route   DELETE /api/v1/vehicles/:id
 * @access  Private
 */
const deleteVehicle = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findOneAndUpdate(
    {
      _id: req.params.id,
      owner: req.userId,
      isActive: true,
    },
    { isActive: false },
    { new: true }
  );

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  ApiResponse.success(res, "Vehicle deleted successfully");
});

/**
 * @desc    Upload vehicle images
 * @route   POST /api/v1/vehicles/:id/images
 * @access  Private
 */
const uploadVehicleImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest("Please upload at least one image");
  }

  const vehicle = await Vehicle.findOne({
    _id: req.params.id,
    owner: req.userId,
    isActive: true,
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  // Upload images
  const uploadResults = await imagekitService.uploadMultipleImages(
    req.files,
    `vehicles/${vehicle._id}`
  );

  // Add to vehicle
  const newImages = uploadResults.map((result) => ({
    url: result.url,
    fileId: result.fileId,
  }));

  vehicle.images.push(...newImages);
  await vehicle.save();

  ApiResponse.success(res, "Images uploaded successfully", {
    images: vehicle.images,
  });
});

/**
 * @desc    Delete vehicle image
 * @route   DELETE /api/v1/vehicles/:id/images/:imageId
 * @access  Private
 */
const deleteVehicleImage = asyncHandler(async (req, res) => {
  const vehicle = await Vehicle.findOne({
    _id: req.params.id,
    owner: req.userId,
    isActive: true,
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  const imageIndex = vehicle.images.findIndex(
    (img) => img._id.toString() === req.params.imageId
  );

  if (imageIndex === -1) {
    throw ApiError.notFound("Image not found");
  }

  // Delete from ImageKit
  await imagekitService.deleteImage(vehicle.images[imageIndex].fileId);

  // Remove from vehicle
  vehicle.images.splice(imageIndex, 1);
  await vehicle.save();

  ApiResponse.success(res, "Image deleted successfully");
});

module.exports = {
  getVehicles,
  getVehicle,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehicleImages,
  deleteVehicleImage,
};
