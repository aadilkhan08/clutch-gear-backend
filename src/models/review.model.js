/**
 * Review Model
 * Customer ratings and reviews
 */
const mongoose = require("mongoose");

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
          enum: ["RESPONDED", "HIDDEN", "SHOWN", "CREATED", "UPDATED"],
        },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        remarks: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
        ret.isVisible = ret.isPublic;
        return ret;
      },
    },
  }
);

// Ensure one review per job card per customer
reviewSchema.index({ customer: 1, jobCard: 1 }, { unique: true });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ isPublic: 1, isVerified: 1 });
reviewSchema.index({ createdAt: -1 });

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
 */
reviewSchema.statics.getWorkshopStats = async function () {
  const stats = await this.aggregate([
    { $match: { isPublic: true, isVerified: true } },
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
    { $match: { isPublic: true, isVerified: true } },
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

reviewSchema.set("toJSON", { virtuals: true });

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
