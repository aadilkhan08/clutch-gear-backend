/**
 * JobCard Controller
 * Handles job card management
 */
const { JobCard, Vehicle, Appointment, User, Payment } = require("../models");
const { smsService, imagekitService, fcmService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

const toUniqueStringIds = (ids = []) => {
  const set = new Set(ids.map((id) => id.toString()));
  return Array.from(set);
};

const ensureMechanicAssigned = (jobCard, mechanicUserId) => {
  const assignedIds = (jobCard.assignedMechanicUserIds || []).map((id) =>
    id.toString(),
  );
  if (!assignedIds.includes(mechanicUserId.toString())) {
    throw ApiError.forbidden("You are not assigned to this job card");
  }
};

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const normalizeJobItems = (jobItems = []) => {
  if (!Array.isArray(jobItems)) return [];
  return jobItems.map((item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Math.max(0, Number(item.unitPrice || 0));
    const discountPct = Math.min(Math.max(Number(item.discount || 0), 0), 100);
    const lineTotal = quantity * unitPrice;
    const discountAmount = (lineTotal * discountPct) / 100;
    const total = Math.max(0, lineTotal - discountAmount);

    return {
      ...item,
      quantity,
      unitPrice,
      discount: discountPct,
      total: round2(total),
    };
  });
};

const ensureJobCardImageArrays = (jobCard) => {
  if (!jobCard.images) {
    jobCard.images = { beforeService: [], afterService: [] };
  }
  if (!Array.isArray(jobCard.images.beforeService)) {
    jobCard.images.beforeService = [];
  }
  if (!Array.isArray(jobCard.images.afterService)) {
    jobCard.images.afterService = [];
  }
};

const maybeRecalculateBilling = async (jobCard) => {
  if (!jobCard) return;
  const items = Array.isArray(jobCard.jobItems) ? jobCard.jobItems : [];
  const hasPricedItems = items.some((i) => Number(i?.total || 0) > 0);
  const grandTotal = Number(jobCard.billing?.grandTotal || 0);

  // If billing is missing/zero but items exist, recompute & persist.
  if (hasPricedItems && grandTotal <= 0) {
    jobCard.set("jobItems", normalizeJobItems(items));
    jobCard.calculateBilling();
    await jobCard.save();
  }
};

/**
 * @desc    Get user's job cards
 * @route   GET /api/v1/jobcards
 * @access  Private
 */
const getJobCards = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const query = { customer: req.userId };
  if (status) query.status = status;

  const [jobCards, total] = await Promise.all([
    JobCard.find(query)
      .populate("vehicle", "vehicleNumber brand model")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JobCard.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Job cards fetched successfully",
    jobCards,
    createPaginationMeta(total, page, limit),
  );
});

/**
 * @desc    Get single job card
 * @route   GET /api/v1/jobcards/:id
 * @access  Private
 */
const getJobCard = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findOne({
    _id: req.params.id,
    customer: req.userId,
  })
    .populate("vehicle")
    .populate("services")
    .populate("appointment");

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  await maybeRecalculateBilling(jobCard);

  const { totalPaid, count } = await Payment.getJobCardPayments(jobCard._id);
  const grandTotal = Number(jobCard.billing?.grandTotal || 0);
  const balanceDue = Math.max(
    0,
    Math.round((grandTotal - Number(totalPaid || 0) + Number.EPSILON) * 100) /
      100,
  );

  const data = jobCard.toJSON();
  data.paymentSummary = {
    grandTotal,
    totalPaid,
    balanceDue,
    completedPaymentsCount: count,
  };

  ApiResponse.success(res, "Job card fetched successfully", data);
});

/**
 * @desc    Approve job items (Customer)
 * @route   PUT /api/v1/jobcards/:id/approve
 * @access  Private
 */
const approveJobItems = asyncHandler(async (req, res) => {
  const { itemIds } = req.body;

  const jobCard = await JobCard.findOne({
    _id: req.params.id,
    customer: req.userId,
    status: "awaiting-approval",
  });

  if (!jobCard) {
    throw ApiError.notFound("Job card not found or not awaiting approval");
  }

  // Approve items
  jobCard.jobItems.forEach((item) => {
    if (itemIds.includes(item._id.toString())) {
      item.isApproved = true;
      item.approvedAt = new Date();
    }
  });

  // Calculate billing
  jobCard.calculateBilling({ onlyApproved: true });

  // Check if all items are approved
  const pendingItems = jobCard.jobItems.filter((item) => !item.isApproved);
  if (pendingItems.length === 0) {
    await jobCard.updateStatus(
      "approved",
      req.userId,
      "All items approved by customer",
    );
  }

  await jobCard.save();

  ApiResponse.success(res, "Items approved successfully", jobCard);
});

/**
 * @desc    Get job card status history
 * @route   GET /api/v1/jobcards/:id/history
 * @access  Private
 */
const getJobCardHistory = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findOne({
    _id: req.params.id,
    customer: req.userId,
  }).select("statusHistory jobNumber");

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  ApiResponse.success(res, "Status history fetched successfully", {
    jobNumber: jobCard.jobNumber,
    history: jobCard.statusHistory,
  });
});

/**
 * @desc    Get active job cards (Customer)
 * @route   GET /api/v1/jobcards/active
 * @access  Private
 */
const getActiveJobCards = asyncHandler(async (req, res) => {
  const jobCards = await JobCard.find({
    customer: req.userId,
    status: { $nin: ["delivered", "cancelled"] },
  })
    .populate("vehicle", "vehicleNumber brand model")
    .sort({ createdAt: -1 })
    .lean();

  ApiResponse.success(res, "Active job cards fetched successfully", jobCards);
});

// ============ Admin Controllers ============

/**
 * @desc    Get all job cards (Admin)
 * @route   GET /api/v1/admin/jobcards
 * @access  Private/Admin
 */
const getAllJobCards = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, customerId, vehicleId, mechanicId, dateFrom, dateTo } =
    req.query;

  const query = {};
  if (status) query.status = status;
  if (customerId) query.customer = customerId;
  if (vehicleId) query.vehicle = vehicleId;
  if (mechanicId) query.assignedMechanicUserIds = mechanicId;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const [jobCards, total] = await Promise.all([
    JobCard.find(query)
      .populate("customer", "name mobile")
      .populate("vehicle", "vehicleNumber brand model")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JobCard.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Job cards fetched successfully",
    jobCards,
    createPaginationMeta(total, page, limit),
  );
});

/**
 * @desc    Get single job card (Admin)
 * @route   GET /api/v1/admin/jobcards/:id
 * @access  Private/Admin
 */
const getJobCardById = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id)
    .populate("customer", "name mobile email")
    .populate("vehicle", "vehicleNumber brand model vehicleType fuelType")
    .populate("services")
    .populate("appointment")
    .populate("assignedMechanicUserIds", "name mobile");

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  await maybeRecalculateBilling(jobCard);

  const { totalPaid, count } = await Payment.getJobCardPayments(jobCard._id);
  const grandTotal = Number(jobCard.billing?.grandTotal || 0);
  const balanceDue = Math.max(
    0,
    Math.round((grandTotal - Number(totalPaid || 0) + Number.EPSILON) * 100) /
      100,
  );

  const data = jobCard.toJSON();
  data.paymentSummary = {
    grandTotal,
    totalPaid,
    balanceDue,
    completedPaymentsCount: count,
  };

  ApiResponse.success(res, "Job card fetched successfully", data);
});

/**
 * @desc    Create job card (Admin)
 * @route   POST /api/v1/admin/jobcards
 * @access  Private/Admin
 */
const createJobCard = asyncHandler(async (req, res) => {
  const {
    customerId,
    vehicleId,
    appointmentId,
    odometerReading,
    fuelLevel,
    customerComplaints,
    services,
    jobItems,
    mechanicUserIds,
    notes,
  } = req.body;

  // Verify customer exists
  const customer = await User.findById(customerId);
  if (!customer) {
    throw ApiError.notFound("Customer not found");
  }

  // Verify vehicle
  const vehicle = await Vehicle.findOne({
    _id: vehicleId,
    owner: customerId,
    isActive: true,
  });

  if (!vehicle) {
    throw ApiError.notFound("Vehicle not found");
  }

  const normalizedItems = normalizeJobItems(jobItems);

  // Create job card
  const jobCard = await JobCard.create({
    customer: customerId,
    vehicle: vehicleId,
    appointment: appointmentId,
    vehicleSnapshot: {
      vehicleNumber: vehicle.vehicleNumber,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
    },
    odometerReading,
    fuelLevel,
    customerComplaints,
    services,
    jobItems: normalizedItems,
    notes,
    statusHistory: [
      {
        status: "created",
        changedAt: new Date(),
        changedBy: req.userId,
        notes: "Job card created",
      },
    ],
  });

  // Ensure billing totals are available immediately (for admin views + payments)
  jobCard.calculateBilling();
  await jobCard.save();

  // Optional: assign mechanics during creation
  if (Array.isArray(mechanicUserIds) && mechanicUserIds.length > 0) {
    const uniqueIds = toUniqueStringIds(mechanicUserIds);

    const mechanics = await User.find({
      _id: { $in: uniqueIds },
      role: "mechanic",
      isActive: true,
    })
      .select("name mobile deviceInfo")
      .lean();

    if (mechanics.length !== uniqueIds.length) {
      throw ApiError.badRequest(
        "One or more mechanicUserIds are invalid or not mechanics",
      );
    }

    jobCard.assignedMechanicUserIds = uniqueIds;
    jobCard.assignedMechanics = mechanics.map((m) => ({
      name: m.name,
      mobile: m.mobile,
      specialization: "",
    }));

    await jobCard.save();

    // Notify mechanics about assignment
    try {
      for (const mechanic of mechanics) {
        await fcmService.notifyMechanicAssignment(mechanic, jobCard);
      }
    } catch (error) {
      console.error("Push notification to mechanics failed:", error);
    }
  }

  // Update appointment status if linked
  if (appointmentId) {
    await Appointment.findByIdAndUpdate(appointmentId, {
      status: "in-progress",
    });
  }

  await jobCard.populate([
    { path: "customer", select: "name mobile" },
    { path: "vehicle", select: "vehicleNumber brand model" },
  ]);

  ApiResponse.created(res, "Job card created successfully", jobCard);
});

/**
 * @desc    Update job card (Admin)
 * @route   PUT /api/v1/admin/jobcards/:id
 * @access  Private/Admin
 */
const updateJobCard = asyncHandler(async (req, res) => {
  const {
    status,
    odometerReading,
    fuelLevel,
    diagnostics,
    assignedMechanics,
    estimatedCompletion,
    notes,
  } = req.body;

  const jobCard = await JobCard.findById(req.params.id).populate(
    "customer",
    "mobile",
  );

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  // Update fields
  if (odometerReading) jobCard.odometerReading = odometerReading;
  if (fuelLevel) jobCard.fuelLevel = fuelLevel;
  if (diagnostics) jobCard.diagnostics = diagnostics;
  if (assignedMechanics) jobCard.assignedMechanics = assignedMechanics;
  if (estimatedCompletion) jobCard.estimatedCompletion = estimatedCompletion;
  if (notes) jobCard.notes = notes;

  // Update status with history
  if (status && status !== jobCard.status) {
    if (status === "delivered") {
      if (jobCard.status !== "ready") {
        throw ApiError.badRequest(
          "Job card must be marked ready before it can be delivered",
        );
      }

      const { totalPaid } = await Payment.getJobCardPayments(jobCard._id);
      const grandTotal = Number(jobCard.billing?.grandTotal || 0);
      const balanceDue = Math.max(0, grandTotal - Number(totalPaid || 0));

      if (balanceDue > 0.01) {
        throw ApiError.badRequest(
          `Cannot mark delivered until payment is completed. Balance due: ₹${balanceDue.toFixed(
            2,
          )}`,
        );
      }
    }

    await jobCard.updateStatus(
      status,
      req.userId,
      `Status changed to ${status}`,
    );

    // Send SMS notification
    try {
      await smsService.sendJobStatusUpdate(jobCard.customer.mobile, {
        jobNumber: jobCard.jobNumber,
        status: status.replace(/-/g, " "),
        vehicleNumber: jobCard.vehicleSnapshot.vehicleNumber,
      });
    } catch (error) {
      console.error("SMS notification failed:", error);
    }

    // Send push notification
    try {
      const customer = await User.findById(
        jobCard.customer._id || jobCard.customer,
      )
        .select("deviceInfo")
        .lean();
      if (customer) {
        await fcmService.notifyJobStatusUpdate(customer, jobCard, status);

        // Special notification for vehicle ready
        if (status === "ready") {
          await fcmService.notifyVehicleReady(customer, jobCard);
        }
      }
    } catch (error) {
      console.error("Push notification failed:", error);
    }
  } else {
    await jobCard.save();
  }

  ApiResponse.success(res, "Job card updated successfully", jobCard);
});

/**
 * @desc    Assign mechanics to a job card (Admin)
 * @route   PUT /api/v1/admin/jobcards/:id/assign-mechanics
 * @access  Private/Admin
 */
const assignMechanics = asyncHandler(async (req, res) => {
  const { mechanicUserIds } = req.body;
  const uniqueIds = toUniqueStringIds(mechanicUserIds);

  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  ensureJobCardImageArrays(jobCard);

  const mechanics = await User.find({
    _id: { $in: uniqueIds },
    role: "mechanic",
    isActive: true,
  })
    .select("name mobile deviceInfo")
    .lean();

  if (mechanics.length !== uniqueIds.length) {
    throw ApiError.badRequest(
      "One or more mechanicUserIds are invalid or not mechanics",
    );
  }

  jobCard.assignedMechanicUserIds = uniqueIds;
  jobCard.assignedMechanics = mechanics.map((m) => ({
    name: m.name,
    mobile: m.mobile,
    specialization: "",
  }));

  await jobCard.save();

  // Notify mechanics about assignment
  try {
    for (const mechanic of mechanics) {
      await fcmService.notifyMechanicAssignment(mechanic, jobCard);
    }
  } catch (error) {
    console.error("Push notification to mechanics failed:", error);
  }

  ApiResponse.success(res, "Mechanics assigned successfully", {
    assignedMechanicUserIds: jobCard.assignedMechanicUserIds,
    assignedMechanics: jobCard.assignedMechanics,
  });
});

// ============ Mechanic Controllers ============

/**
 * @desc    Get assigned job cards (Mechanic)
 * @route   GET /api/v1/mechanic/jobcards
 * @access  Private/Mechanic
 */
const getAssignedJobCards = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;

  const query = { assignedMechanicUserIds: req.userId };
  if (status) query.status = status;

  const [jobCards, total] = await Promise.all([
    JobCard.find(query)
      .populate("customer", "name mobile")
      .populate("vehicle", "vehicleNumber brand model")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    JobCard.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Assigned job cards fetched successfully",
    jobCards,
    createPaginationMeta(total, page, limit),
  );
});

/**
 * @desc    Get assigned job card detail (Mechanic)
 * @route   GET /api/v1/mechanic/jobcards/:id
 * @access  Private/Mechanic
 */
const getAssignedJobCard = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id)
    .populate("customer", "name mobile")
    .populate("vehicle")
    .populate("services")
    .populate("appointment");

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  ensureMechanicAssigned(jobCard, req.userId);

  const { totalPaid, count } = await Payment.getJobCardPayments(jobCard._id);
  const grandTotal = Number(jobCard.billing?.grandTotal || 0);
  const balanceDue = Math.max(
    0,
    Math.round((grandTotal - Number(totalPaid || 0) + Number.EPSILON) * 100) /
      100,
  );

  const data = jobCard.toJSON();
  data.paymentSummary = {
    grandTotal,
    totalPaid,
    balanceDue,
    completedPaymentsCount: count,
  };

  ApiResponse.success(res, "Job card fetched successfully", data);
});

/**
 * @desc    Update assigned job card status (Mechanic)
 * @route   PATCH /api/v1/mechanic/jobcards/:id/status
 * @access  Private/Mechanic
 */
const updateAssignedJobCardStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  ensureMechanicAssigned(jobCard, req.userId);

  ensureJobCardImageArrays(jobCard);

  if (status !== jobCard.status) {
    if (status === "delivered") {
      if (jobCard.status !== "ready") {
        throw ApiError.badRequest(
          "Job card must be marked ready before it can be delivered",
        );
      }

      const { totalPaid } = await Payment.getJobCardPayments(jobCard._id);
      const grandTotal = Number(jobCard.billing?.grandTotal || 0);
      const balanceDue = Math.max(0, grandTotal - Number(totalPaid || 0));

      if (balanceDue > 0.01) {
        throw ApiError.badRequest(
          `Cannot mark delivered until payment is completed. Balance due: ₹${balanceDue.toFixed(
            2,
          )}`,
        );
      }
    }

    await jobCard.updateStatus(status, req.userId, notes || "");
  }

  ApiResponse.success(res, "Job card status updated successfully", jobCard);
});

/**
 * @desc    Upload job card images (Mechanic)
 * @route   POST /api/v1/mechanic/jobcards/:id/images
 * @access  Private/Mechanic
 */
const uploadAssignedJobCardImages = asyncHandler(async (req, res) => {
  const imageType = req.body?.imageType || "beforeService"; // 'beforeService' or 'afterService'

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest("Please upload at least one image");
  }

  if (!["beforeService", "afterService"].includes(imageType)) {
    throw ApiError.badRequest("Invalid image type");
  }

  const jobCard = await JobCard.findById(req.params.id);
  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  ensureMechanicAssigned(jobCard, req.userId);

  const uploadResults = await imagekitService.uploadMultipleImages(
    req.files,
    `jobcards/${jobCard._id}/${imageType}`,
  );

  const newImages = uploadResults.map((result) => ({
    url: result.url,
    fileId: result.fileId,
  }));

  jobCard.images[imageType].push(...newImages);
  await jobCard.save();

  ApiResponse.success(res, "Images uploaded successfully", {
    images: jobCard.images[imageType],
  });
});

/**
 * @desc    Add job item (Admin)
 * @route   POST /api/v1/admin/jobcards/:id/items
 * @access  Private/Admin
 */
const addJobItem = asyncHandler(async (req, res) => {
  const { type, description, quantity, unitPrice, discount } = req.body;

  const jobCard = await JobCard.findById(req.params.id);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  const safeQty = Math.max(1, Number(quantity || 1));
  const safeUnitPrice = Math.max(0, Number(unitPrice || 0));
  const discountPct = Math.min(Math.max(Number(discount || 0), 0), 100);
  const lineTotal = safeQty * safeUnitPrice;
  const discountAmount = (lineTotal * discountPct) / 100;
  const total = Math.max(0, lineTotal - discountAmount);

  jobCard.jobItems.push({
    type,
    description,
    quantity: safeQty,
    unitPrice: safeUnitPrice,
    discount: discountPct,
    total: round2(total),
  });

  jobCard.calculateBilling();

  // If there are unapproved items, set status to awaiting-approval
  if (jobCard.status === "inspection" || jobCard.status === "in-progress") {
    await jobCard.updateStatus(
      "awaiting-approval",
      req.userId,
      "New items added for approval",
    );
  } else {
    await jobCard.save();
  }

  ApiResponse.success(res, "Job item added successfully", jobCard);
});

/**
 * @desc    Remove job item (Admin)
 * @route   DELETE /api/v1/admin/jobcards/:id/items/:itemId
 * @access  Private/Admin
 */
const removeJobItem = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findById(req.params.id);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  const itemIndex = jobCard.jobItems.findIndex(
    (item) => item._id.toString() === req.params.itemId,
  );

  if (itemIndex === -1) {
    throw ApiError.notFound("Job item not found");
  }

  jobCard.jobItems.splice(itemIndex, 1);
  jobCard.calculateBilling();
  await jobCard.save();

  ApiResponse.success(res, "Job item removed successfully", jobCard);
});

/**
 * @desc    Update billing (Admin)
 * @route   PUT /api/v1/admin/jobcards/:id/billing
 * @access  Private/Admin
 */
const updateBilling = asyncHandler(async (req, res) => {
  const { discount, discountReason, taxRate } = req.body;

  const jobCard = await JobCard.findById(req.params.id);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  if (discount !== undefined) jobCard.billing.discount = discount;
  if (discountReason) jobCard.billing.discountReason = discountReason;
  if (taxRate !== undefined) jobCard.billing.taxRate = taxRate;

  jobCard.calculateBilling();
  await jobCard.save();

  ApiResponse.success(res, "Billing updated successfully", {
    billing: jobCard.billing,
  });
});

/**
 * @desc    Upload job card images (Admin)
 * @route   POST /api/v1/admin/jobcards/:id/images
 * @access  Private/Admin
 */
const uploadJobCardImages = asyncHandler(async (req, res) => {
  const imageType = req.body?.imageType || "beforeService"; // 'beforeService' or 'afterService'

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest("Please upload at least one image");
  }

  if (!["beforeService", "afterService"].includes(imageType)) {
    throw ApiError.badRequest("Invalid image type");
  }

  const jobCard = await JobCard.findById(req.params.id);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  // Upload images
  const uploadResults = await imagekitService.uploadMultipleImages(
    req.files,
    `jobcards/${jobCard._id}/${imageType}`,
  );

  // Add to job card
  const newImages = uploadResults.map((result) => ({
    url: result.url,
    fileId: result.fileId,
  }));

  jobCard.images[imageType].push(...newImages);
  await jobCard.save();

  ApiResponse.success(res, "Images uploaded successfully", {
    images: jobCard.images[imageType],
  });
});

/**
 * @desc    Upload job card videos (Admin)
 * @route   POST /api/v1/admin/jobcards/:id/videos
 * @access  Private/Admin
 */
const uploadJobCardVideos = asyncHandler(async (req, res) => {
  const videoType = req.body?.videoType || "beforeService"; // 'beforeService' or 'afterService'

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest("Please upload at least one video");
  }

  if (!["beforeService", "afterService"].includes(videoType)) {
    throw ApiError.badRequest("Invalid video type");
  }

  const jobCard = await JobCard.findById(req.params.id);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  // Upload videos
  const uploadResults = await imagekitService.uploadMultipleVideos(
    req.files,
    `jobcards/${jobCard._id}/videos/${videoType}`,
  );

  // Initialize videos object if not exists
  if (!jobCard.videos) {
    jobCard.videos = { beforeService: [], afterService: [] };
  }

  // Add to job card
  const newVideos = uploadResults.map((result) => ({
    url: result.url,
    fileId: result.fileId,
    thumbnailUrl: result.thumbnailUrl,
  }));

  jobCard.videos[videoType].push(...newVideos);
  await jobCard.save();

  ApiResponse.success(res, "Videos uploaded successfully", {
    videos: jobCard.videos[videoType],
  });
});

/**
 * @desc    Upload job card mixed media (images + videos) (Admin)
 * @route   POST /api/v1/admin/jobcards/:id/media
 * @access  Private/Admin
 */
const uploadJobCardMedia = asyncHandler(async (req, res) => {
  const mediaType = req.body?.mediaType || "beforeService";

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest("Please upload at least one file");
  }

  if (!["beforeService", "afterService"].includes(mediaType)) {
    throw ApiError.badRequest("Invalid media type");
  }

  const jobCard = await JobCard.findById(req.params.id);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  // Separate images and videos
  const imageFiles = req.files.filter((f) => f.mimetype.startsWith("image/"));
  const videoFiles = req.files.filter((f) => f.mimetype.startsWith("video/"));

  const results = { images: [], videos: [] };

  // Upload images
  if (imageFiles.length > 0) {
    const imageResults = await imagekitService.uploadMultipleImages(
      imageFiles,
      `jobcards/${jobCard._id}/${mediaType}`,
    );
    results.images = imageResults.map((r) => ({
      url: r.url,
      fileId: r.fileId,
    }));
    jobCard.images[mediaType].push(...results.images);
  }

  // Upload videos
  if (videoFiles.length > 0) {
    if (!jobCard.videos) {
      jobCard.videos = { beforeService: [], afterService: [] };
    }
    const videoResults = await imagekitService.uploadMultipleVideos(
      videoFiles,
      `jobcards/${jobCard._id}/videos/${mediaType}`,
    );
    results.videos = videoResults.map((r) => ({
      url: r.url,
      fileId: r.fileId,
      thumbnailUrl: r.thumbnailUrl,
    }));
    jobCard.videos[mediaType].push(...results.videos);
  }

  await jobCard.save();

  ApiResponse.success(res, "Media uploaded successfully", results);
});

/**
 * @desc    Get active job cards count (Admin dashboard)
 * @route   GET /api/v1/admin/jobcards/stats
 * @access  Private/Admin
 */
const getJobCardStats = asyncHandler(async (req, res) => {
  const stats = await JobCard.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const statusCounts = {};
  stats.forEach((s) => {
    statusCounts[s._id] = s.count;
  });

  const totalActive = await JobCard.countDocuments({
    status: { $nin: ["delivered", "cancelled"] },
  });

  ApiResponse.success(res, "Job card stats fetched successfully", {
    statusCounts,
    totalActive,
  });
});

module.exports = {
  // User
  getJobCards,
  getJobCard,
  approveJobItems,
  getJobCardHistory,
  getActiveJobCards,
  // Admin
  getAllJobCards,
  getJobCardById,
  createJobCard,
  updateJobCard,
  assignMechanics,
  addJobItem,
  removeJobItem,
  updateBilling,
  uploadJobCardImages,
  uploadJobCardVideos,
  uploadJobCardMedia,
  getJobCardStats,
  // Mechanic
  getAssignedJobCards,
  getAssignedJobCard,
  updateAssignedJobCardStatus,
  uploadAssignedJobCardImages,
};
