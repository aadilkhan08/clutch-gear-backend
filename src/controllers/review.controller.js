/**
 * Review Controller
 * Handles customer reviews and ratings
 */
const { Review, JobCard, Garage } = require("../models");
const { imagekitService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

const sanitizeText = (value) =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim() : value;

const updateGarageRatingSummary = async () => {
  const garage = await Garage.findOne();
  if (!garage) return;

  const stats = await Review.aggregate([
    {
      $match: {
        $or: [
          { status: "APPROVED" },
          { isPublic: true, isVerified: true }, // Legacy fallback
        ],
      },
    },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const distributionAgg = await Review.aggregate([
    {
      $match: {
        $or: [
          { status: "APPROVED" },
          { isPublic: true, isVerified: true }, // Legacy fallback
        ],
      },
    },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distributionAgg.forEach((d) => {
    distribution[d._id] = d.count;
  });

  const average = stats?.[0]?.average || 0;
  const count = stats?.[0]?.count || 0;

  garage.ratings.average = Math.round(average * 10) / 10;
  garage.ratings.count = count;
  garage.ratings.distribution = distribution;
  await garage.save();
};

/**
 * @desc    Get user's reviews
 * @route   GET /api/v1/reviews
 * @access  Private
 */
const getMyReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const [reviews, total] = await Promise.all([
    Review.find({ customer: req.userId })
      .populate("jobCard", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments({ customer: req.userId }),
  ]);

  ApiResponse.paginated(
    res,
    "Reviews fetched successfully",
    reviews,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get review by job card ID (check if review exists)
 * @route   GET /api/v1/reviews/job/:jobCardId
 * @access  Private
 */
const getReviewByJobCard = asyncHandler(async (req, res) => {
  const { jobCardId } = req.params;

  const review = await Review.findOne({
    jobCard: jobCardId,
    customer: req.userId,
  })
    .populate("jobCard", "jobNumber vehicleSnapshot status")
    .lean();

  if (!review) {
    // Check if job card exists and is eligible for review
    const jobCard = await JobCard.findOne({
      _id: jobCardId,
      customer: req.userId,
    })
      .select("status jobNumber vehicleSnapshot")
      .lean();

    if (!jobCard) {
      throw ApiError.notFound("Job card not found");
    }

    return ApiResponse.success(res, "No review found for this job card", {
      review: null,
      jobCard,
      canReview: jobCard.status === "delivered",
    });
  }

  ApiResponse.success(res, "Review found", {
    review,
    jobCard: review.jobCard,
    canReview: false,
  });
});

/**
 * @desc    Create review
 * @route   POST /api/v1/reviews
 * @access  Private
 */
const createReview = asyncHandler(async (req, res) => {
  const {
    jobCardId,
    rating,
    title,
    comment,
    serviceQuality,
    timelinessRating,
    valueForMoney,
    staffBehavior,
    wouldRecommend,
  } = req.body;

  // Check if job card exists and belongs to user
  const jobCard = await JobCard.findOne({
    _id: jobCardId,
    customer: req.userId,
    status: "delivered",
  });

  if (!jobCard) {
    throw ApiError.notFound("Job card not found or not eligible for review");
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({
    customer: req.userId,
    jobCard: jobCardId,
  });

  if (existingReview) {
    throw ApiError.conflict("You have already reviewed this service");
  }

  const review = await Review.create({
    customer: req.userId,
    jobCard: jobCardId,
    rating,
    title: sanitizeText(title),
    comment: sanitizeText(comment),
    serviceQuality,
    timelinessRating,
    valueForMoney,
    staffBehavior,
    wouldRecommend,
    // New reviews start as APPROVED by default (auto-approval)
    // Admin can hide inappropriate reviews later
    status: "APPROVED",
    isVerified: true,
    isPublic: true,
    moderationLogs: [{ action: "CREATED", actor: req.userId }],
  });

  await review.populate("jobCard", "jobNumber vehicleSnapshot");

  ApiResponse.created(res, "Review submitted successfully", review);
  updateGarageRatingSummary().catch(() => {});
});

/**
 * @desc    Update review
 * @route   PUT /api/v1/reviews/:id
 * @access  Private
 */
const updateReview = asyncHandler(async (req, res) => {
  const { rating, title, comment } = req.body;

  const review = await Review.findOne({
    _id: req.params.id,
    customer: req.userId,
  });

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  // Can only update within 7 days
  const daysSinceCreation =
    (Date.now() - review.createdAt) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation > 7) {
    throw ApiError.badRequest(
      "Can only update review within 7 days of submission"
    );
  }

  if (rating) review.rating = rating;
  if (title !== undefined) review.title = sanitizeText(title);
  if (comment !== undefined) review.comment = sanitizeText(comment);

  review.moderationLogs = review.moderationLogs || [];
  review.moderationLogs.push({ action: "UPDATED", actor: req.userId });

  await review.save();

  ApiResponse.success(res, "Review updated successfully", review);
  updateGarageRatingSummary().catch(() => {});
});

/**
 * @desc    Delete review
 * @route   DELETE /api/v1/reviews/:id
 * @access  Private
 */
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOneAndDelete({
    _id: req.params.id,
    customer: req.userId,
  });

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  ApiResponse.success(res, "Review deleted successfully");
  updateGarageRatingSummary().catch(() => {});
});

/**
 * @desc    Get public reviews
 * @route   GET /api/v1/reviews/public
 * @access  Public
 */
const getPublicReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { rating, sort } = req.query;

  // Query for approved reviews (status or legacy fields)
  const query = {
    $or: [
      { status: "APPROVED" },
      { isPublic: true, isVerified: true }, // Legacy fallback
    ],
  };
  if (rating) {
    query.rating = parseInt(rating, 10);
  }

  // Determine sort order
  let sortOrder = { createdAt: -1 };
  if (sort === "highest") {
    sortOrder = { rating: -1, createdAt: -1 };
  } else if (sort === "lowest") {
    sortOrder = { rating: 1, createdAt: -1 };
  }

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("customer", "name profileImage")
      .select("-moderationLogs")
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ]);

  const mapped = reviews.map((r) => ({
    ...r,
    isVisible: r.status === "APPROVED" || r.isPublic,
  }));

  ApiResponse.paginated(
    res,
    "Reviews fetched successfully",
    mapped,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get workshop stats (public)
 * @route   GET /api/v1/reviews/stats
 * @access  Public
 */
const getWorkshopStats = asyncHandler(async (req, res) => {
  const [stats, distribution] = await Promise.all([
    Review.getWorkshopStats(),
    Review.getRatingDistribution(),
  ]);

  ApiResponse.success(res, "Workshop stats fetched successfully", {
    ...stats,
    distribution,
  });
});

// ============ Admin Controllers ============

/**
 * @desc    Get all reviews (Admin)
 * @route   GET /api/v1/admin/reviews
 * @access  Private/Admin
 */
const getAllReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { rating, isPublic, hasResponse } = req.query;

  const query = {};
  if (rating) query.rating = parseInt(rating, 10);
  if (isPublic !== undefined) query.isPublic = isPublic === "true";
  if (hasResponse !== undefined) {
    query["adminResponse.response"] =
      hasResponse === "true" ? { $exists: true } : { $exists: false };
  }

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("customer", "name mobile")
      .populate("jobCard", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ]);

  const mapped = reviews.map((r) => ({
    ...r,
    isVisible: r.isPublic,
  }));

  ApiResponse.paginated(
    res,
    "Reviews fetched successfully",
    mapped,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Respond to review (Admin)
 * @route   PUT /api/v1/admin/reviews/:id/respond
 * @access  Private/Admin
 */
const respondToReview = asyncHandler(async (req, res) => {
  const { response } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  review.adminResponse = {
    response: sanitizeText(response),
    respondedAt: new Date(),
    respondedBy: req.userId,
  };

  review.moderationLogs = review.moderationLogs || [];
  review.moderationLogs.push({
    action: "RESPONDED",
    actor: req.userId,
    remarks: sanitizeText(response),
  });

  await review.save();

  ApiResponse.success(res, "Response added successfully", review);
});

/**
 * @desc    Toggle review visibility (Admin)
 * @route   PUT /api/v1/admin/reviews/:id/visibility
 * @access  Private/Admin
 */
const toggleVisibility = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  // Toggle between APPROVED and HIDDEN status
  const newStatus = review.status === "HIDDEN" ? "APPROVED" : "HIDDEN";
  review.status = newStatus;
  review.isPublic = newStatus === "APPROVED";

  review.moderationLogs = review.moderationLogs || [];
  review.moderationLogs.push({
    action: newStatus === "APPROVED" ? "SHOWN" : "HIDDEN",
    actor: req.userId,
  });
  await review.save();

  ApiResponse.success(
    res,
    `Review ${newStatus === "APPROVED" ? "published" : "hidden"} successfully`,
    review
  );
  updateGarageRatingSummary().catch(() => {});
});

/**
 * @desc    Update review status (Admin)
 * @route   PUT /api/v1/admin/reviews/:id/status
 * @access  Private/Admin
 */
const updateReviewStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["PENDING", "APPROVED", "HIDDEN"].includes(status)) {
    throw ApiError.badRequest("Invalid status. Use PENDING, APPROVED, or HIDDEN");
  }

  const review = await Review.findById(req.params.id);

  if (!review) {
    throw ApiError.notFound("Review not found");
  }

  const previousStatus = review.status;
  review.status = status;
  review.isPublic = status === "APPROVED";
  review.isVerified = status === "APPROVED";

  review.moderationLogs = review.moderationLogs || [];
  review.moderationLogs.push({
    action: status,
    actor: req.userId,
    remarks: `Status changed from ${previousStatus || "N/A"} to ${status}`,
  });
  await review.save();

  ApiResponse.success(res, `Review status updated to ${status}`, review);
  updateGarageRatingSummary().catch(() => {});
});

/**
 * @desc    Get review analytics (Admin)
 * @route   GET /api/v1/admin/reviews/analytics
 * @access  Private/Admin
 */
const getReviewAnalytics = asyncHandler(async (req, res) => {
  const { period } = req.query; // 'week', 'month', 'quarter', 'year'

  let dateFilter = {};
  const now = new Date();

  switch (period) {
    case "week":
      dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
      break;
    case "month":
      dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
      break;
    case "quarter":
      dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 3)) };
      break;
    case "year":
      dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
      break;
    default:
      dateFilter = {};
  }

  const query =
    Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [stats, distribution, recentReviews] = await Promise.all([
    Review.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          avgServiceQuality: { $avg: "$serviceQuality" },
          avgTimeliness: { $avg: "$timelinessRating" },
          avgValue: { $avg: "$valueForMoney" },
          avgStaffBehavior: { $avg: "$staffBehavior" },
        },
      },
    ]),
    Review.aggregate([
      { $match: query },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]),
    Review.find(query)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const distributionMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach((d) => {
    distributionMap[d._id] = d.count;
  });

  ApiResponse.success(res, "Review analytics fetched successfully", {
    summary: stats[0] || { totalReviews: 0, avgRating: 0 },
    distribution: distributionMap,
    recentReviews,
  });
});

module.exports = {
  // User
  getMyReviews,
  getReviewByJobCard,
  createReview,
  updateReview,
  deleteReview,
  // Public
  getPublicReviews,
  getWorkshopStats,
  // Admin
  getAllReviews,
  respondToReview,
  toggleVisibility,
  updateReviewStatus,
  getReviewAnalytics,
};
