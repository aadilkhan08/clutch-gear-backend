/**
 * Review Model
 * Customer ratings and reviews
 */
const mongoose = require("mongoose");

// Review status enum
const REVIEW_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  HIDDEN: "HIDDEN",
};

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    jobCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCard",
      required: [true, "Job card is required"],
    },
    // Keeping garageId for future multi-garage support
    garage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    // Review moderation status
    status: {
      type: String,
      enum: Object.values(REVIEW_STATUS),
      default: REVIEW_STATUS.PENDING,
    },
    serviceQuality: {
      type: Number,
      min: 1,
      max: 5,
    },
    timelinessRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    valueForMoney: {
      type: Number,
      min: 1,
      max: 5,
    },
    staffBehavior: {
      type: Number,
      min: 1,
      max: 5,
    },
    wouldRecommend: {
      type: Boolean,
      default: true,
    },
    images: [
      {
        url: String,
        fileId: String,
      },
    ],
    adminResponse: {
      response: String,
      respondedAt: Date,
      respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    moderationLogs: [
      {
        action: {
          type: String,
          enum: [
            "RESPONDED",
            "HIDDEN",
            "SHOWN",
            "CREATED",
            "UPDATED",
            "APPROVED",
            "PENDING",
          ],
        },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        remarks: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // Legacy fields kept for backward compatibility
    isPublic: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        // Compute isVisible from status
        ret.isVisible = ret.status === "APPROVED" || ret.isPublic;
        return ret;
      },
    },
  }
);

// Ensure one review per job card per customer
reviewSchema.index({ customer: 1, jobCard: 1 }, { unique: true });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ isPublic: 1, isVerified: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ jobCard: 1 }); // For quick lookup by jobCard

/**
 * Calculate average rating
 */
reviewSchema.virtual("averageRating").get(function () {
  const ratings = [
    this.serviceQuality,
    this.timelinessRating,
    this.valueForMoney,
    this.staffBehavior,
  ].filter((r) => r != null);

  if (ratings.length === 0) return this.rating;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
});

/**
 * Get workshop statistics
 * Uses status: APPROVED for filtering approved reviews
 */
reviewSchema.statics.getWorkshopStats = async function () {
  const stats = await this.aggregate([
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
        totalReviews: { $sum: 1 },
        avgRating: { $avg: "$rating" },
        avgServiceQuality: { $avg: "$serviceQuality" },
        avgTimeliness: { $avg: "$timelinessRating" },
        avgValue: { $avg: "$valueForMoney" },
        avgStaffBehavior: { $avg: "$staffBehavior" },
        recommendCount: {
          $sum: { $cond: ["$wouldRecommend", 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalReviews: 1,
        avgRating: { $round: ["$avgRating", 1] },
        avgServiceQuality: { $round: ["$avgServiceQuality", 1] },
        avgTimeliness: { $round: ["$avgTimeliness", 1] },
        avgValue: { $round: ["$avgValue", 1] },
        avgStaffBehavior: { $round: ["$avgStaffBehavior", 1] },
        recommendPercentage: {
          $round: [
            {
              $multiply: [
                { $divide: ["$recommendCount", "$totalReviews"] },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
  ]);

  return (
    stats[0] || {
      totalReviews: 0,
      avgRating: 0,
      recommendPercentage: 0,
    }
  );
};

/**
 * Get rating distribution
 */
reviewSchema.statics.getRatingDistribution = async function () {
  const distribution = await this.aggregate([
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
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const result = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distribution.forEach((d) => {
    result[d._id] = d.count;
  });

  return result;
};

/**
 * Get review by job card ID
 */
reviewSchema.statics.getByJobCard = async function (jobCardId, customerId) {
  return this.findOne({
    jobCard: jobCardId,
    customer: customerId,
  }).lean();
};

reviewSchema.set("toJSON", { virtuals: true });

const Review = mongoose.model("Review", reviewSchema);

// Export status enum for use in controllers
Review.REVIEW_STATUS = REVIEW_STATUS;

module.exports = Review;
