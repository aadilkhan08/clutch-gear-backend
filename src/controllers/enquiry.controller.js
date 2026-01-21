/**
 * Enquiry Controller
 * Handles enquiry/lead management
 */
const { Enquiry, User, Service, Appointment, JobCard } = require("../models");
const { fcmService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

/**
 * @desc    Create new enquiry
 * @route   POST /api/v1/admin/enquiries
 * @access  Private/Admin
 */
const createEnquiry = asyncHandler(async (req, res) => {
  const {
    name,
    mobile,
    email,
    vehicleInfo,
    enquiryType,
    serviceInterest,
    description,
    source,
    priority,
    notes,
    nextFollowUp,
  } = req.body;

  // Check if lead with same mobile exists
  const existingEnquiry = await Enquiry.findOne({
    mobile,
    status: { $nin: ["converted", "closed"] },
  });

  if (existingEnquiry) {
    throw ApiError.conflict(
      "An active enquiry with this mobile number already exists"
    );
  }

  const enquiry = await Enquiry.create({
    name,
    mobile,
    email,
    vehicleInfo,
    enquiryType: enquiryType || "general",
    serviceInterest,
    description,
    source: source || "walk-in",
    priority: priority || "medium",
    notes,
    nextFollowUp,
    createdBy: req.userId,
    lastModifiedBy: req.userId,
  });

  ApiResponse.created(res, "Enquiry created successfully", enquiry);
});

/**
 * @desc    Get all enquiries with filters
 * @route   GET /api/v1/admin/enquiries
 * @access  Private/Admin
 */
const getEnquiries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const {
    status,
    priority,
    source,
    enquiryType,
    assignedTo,
    search,
    followUpToday,
  } = req.query;

  const query = {};

  // Apply filters
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (source) query.source = source;
  if (enquiryType) query.enquiryType = enquiryType;
  if (assignedTo) query.assignedTo = assignedTo;

  // Search by name or mobile
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }

  // Filter for today's follow-ups
  if (followUpToday === "true") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    query.nextFollowUp = { $gte: today, $lt: tomorrow };
  }

  const [enquiries, total] = await Promise.all([
    Enquiry.find(query)
      .populate("assignedTo", "name")
      .populate("serviceInterest", "name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Enquiry.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Enquiries fetched successfully",
    enquiries,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get single enquiry
 * @route   GET /api/v1/admin/enquiries/:id
 * @access  Private/Admin
 */
const getEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id)
    .populate("assignedTo", "name mobile")
    .populate("serviceInterest", "name price")
    .populate("referredBy", "name mobile")
    .populate("createdBy", "name")
    .populate("followUpHistory.createdBy", "name");

  if (!enquiry) {
    throw ApiError.notFound("Enquiry not found");
  }

  ApiResponse.success(res, "Enquiry fetched successfully", enquiry);
});

/**
 * @desc    Update enquiry
 * @route   PUT /api/v1/admin/enquiries/:id
 * @access  Private/Admin
 */
const updateEnquiry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const enquiry = await Enquiry.findById(id);

  if (!enquiry) {
    throw ApiError.notFound("Enquiry not found");
  }

  // Prevent updating converted/closed enquiries
  if (["converted", "closed"].includes(enquiry.status) && updates.status) {
    if (!["converted", "closed"].includes(updates.status)) {
      throw ApiError.badRequest("Cannot reopen a converted or closed enquiry");
    }
  }

  // Apply updates
  Object.assign(enquiry, updates);
  enquiry.lastModifiedBy = req.userId;

  await enquiry.save();

  ApiResponse.success(res, "Enquiry updated successfully", enquiry);
});

/**
 * @desc    Add follow-up to enquiry
 * @route   POST /api/v1/admin/enquiries/:id/follow-up
 * @access  Private/Admin
 */
const addFollowUp = asyncHandler(async (req, res) => {
  const { action, notes, outcome, nextFollowUp } = req.body;

  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw ApiError.notFound("Enquiry not found");
  }

  enquiry.followUpHistory.push({
    date: new Date(),
    action,
    notes,
    outcome,
    createdBy: req.userId,
  });

  if (nextFollowUp) {
    enquiry.nextFollowUp = new Date(nextFollowUp);
  }

  enquiry.lastModifiedBy = req.userId;
  await enquiry.save();

  ApiResponse.success(res, "Follow-up added successfully", enquiry);
});

/**
 * @desc    Assign enquiry to staff
 * @route   PUT /api/v1/admin/enquiries/:id/assign
 * @access  Private/Admin
 */
const assignEnquiry = asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;

  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw ApiError.notFound("Enquiry not found");
  }

  // Verify assignee exists and is admin/mechanic
  const assignee = await User.findById(assignedTo);
  if (!assignee || !["admin", "mechanic"].includes(assignee.role)) {
    throw ApiError.badRequest("Invalid assignee");
  }

  enquiry.assignedTo = assignedTo;
  enquiry.lastModifiedBy = req.userId;
  await enquiry.save();

  // Notify assigned staff (if they have FCM token)
  if (assignee.deviceInfo?.fcmToken) {
    await fcmService.sendToDevice(
      assignee.deviceInfo.fcmToken,
      {
        title: "New Lead Assigned",
        body: `Lead from ${enquiry.name} (${enquiry.mobile}) has been assigned to you`,
      },
      {
        type: "LEAD_ASSIGNED",
        enquiryId: enquiry._id.toString(),
      }
    );
  }

  await enquiry.populate("assignedTo", "name mobile");

  ApiResponse.success(res, "Enquiry assigned successfully", enquiry);
});

/**
 * @desc    Convert enquiry to customer/appointment/jobcard
 * @route   POST /api/v1/admin/enquiries/:id/convert
 * @access  Private/Admin
 */
const convertEnquiry = asyncHandler(async (req, res) => {
  const { convertTo, appointmentData, jobCardData } = req.body;

  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw ApiError.notFound("Enquiry not found");
  }

  if (enquiry.status === "converted") {
    throw ApiError.badRequest("Enquiry already converted");
  }

  let convertedRef = null;
  let refModel = null;

  switch (convertTo) {
    case "customer": {
      // Check if user already exists
      let user = await User.findOne({ mobile: enquiry.mobile });

      if (!user) {
        user = await User.create({
          name: enquiry.name,
          mobile: enquiry.mobile,
          email: enquiry.email,
          role: "user",
          isVerified: false,
        });
      }

      convertedRef = user._id;
      refModel = "User";
      break;
    }

    case "appointment": {
      // Create customer first if needed
      let user = await User.findOne({ mobile: enquiry.mobile });

      if (!user) {
        user = await User.create({
          name: enquiry.name,
          mobile: enquiry.mobile,
          email: enquiry.email,
          role: "user",
        });
      }

      // Create appointment
      const appointment = await Appointment.create({
        customer: user._id,
        ...appointmentData,
        notes: enquiry.description || appointmentData?.notes,
      });

      convertedRef = appointment._id;
      refModel = "Appointment";
      break;
    }

    case "jobcard": {
      // Create customer first if needed
      let user = await User.findOne({ mobile: enquiry.mobile });

      if (!user) {
        user = await User.create({
          name: enquiry.name,
          mobile: enquiry.mobile,
          email: enquiry.email,
          role: "user",
        });
      }

      // Create job card
      const jobCard = await JobCard.create({
        customer: user._id,
        ...jobCardData,
        notes: enquiry.description || jobCardData?.notes,
      });

      convertedRef = jobCard._id;
      refModel = "JobCard";
      break;
    }

    default:
      throw ApiError.badRequest("Invalid conversion type");
  }

  // Update enquiry
  enquiry.status = "converted";
  enquiry.convertedTo = convertTo;
  enquiry.convertedRefId = convertedRef;
  enquiry.convertedRefModel = refModel;
  enquiry.convertedAt = new Date();
  enquiry.lastModifiedBy = req.userId;
  await enquiry.save();

  ApiResponse.success(res, `Enquiry converted to ${convertTo} successfully`, {
    enquiry,
    convertedRef,
  });
});

/**
 * @desc    Get enquiry statistics
 * @route   GET /api/v1/admin/enquiries/stats
 * @access  Private/Admin
 */
const getEnquiryStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalEnquiries,
    newEnquiries,
    followUpsToday,
    statusCounts,
    sourceCounts,
    conversionRate,
  ] = await Promise.all([
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: "new" }),
    Enquiry.countDocuments({
      nextFollowUp: { $gte: today, $lt: tomorrow },
      status: { $nin: ["converted", "closed"] },
    }),
    Enquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Enquiry.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
    Enquiry.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          converted: [{ $match: { status: "converted" } }, { $count: "count" }],
        },
      },
    ]),
  ]);

  const total = conversionRate[0]?.total[0]?.count || 0;
  const converted = conversionRate[0]?.converted[0]?.count || 0;
  const rate = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;

  ApiResponse.success(res, "Enquiry stats fetched successfully", {
    totalEnquiries,
    newEnquiries,
    followUpsToday,
    statusBreakdown: statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    sourceBreakdown: sourceCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    conversionRate: `${rate}%`,
  });
});

/**
 * @desc    Delete enquiry
 * @route   DELETE /api/v1/admin/enquiries/:id
 * @access  Private/Admin
 */
const deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await Enquiry.findById(req.params.id);

  if (!enquiry) {
    throw ApiError.notFound("Enquiry not found");
  }

  await enquiry.deleteOne();

  ApiResponse.success(res, "Enquiry deleted successfully");
});

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiry,
  updateEnquiry,
  addFollowUp,
  assignEnquiry,
  convertEnquiry,
  getEnquiryStats,
  deleteEnquiry,
};
