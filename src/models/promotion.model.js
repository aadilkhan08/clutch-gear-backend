/**
 * Promotion Model
 * Banner promotions and offers displayed to customers
 */
const mongoose = require("mongoose");

const promotionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Promotion title is required"],
            trim: true,
            maxlength: [100, "Title cannot exceed 100 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, "Description cannot exceed 500 characters"],
        },
        bannerImage: {
            url: { type: String, required: [true, "Banner image URL is required"] },
            fileId: { type: String },
            thumbnailUrl: { type: String },
        },
        // Call-to-action configuration
        ctaType: {
            type: String,
            enum: ["service", "package", "url", "booking", "none"],
            default: "none",
        },
        ctaValue: {
            type: String,
            trim: true,
        },
        ctaLabel: {
            type: String,
            trim: true,
            maxlength: [30, "CTA label cannot exceed 30 characters"],
            default: "Learn More",
        },
        // Scheduling
        startDate: {
            type: Date,
            required: [true, "Start date is required"],
        },
        endDate: {
            type: Date,
            required: [true, "End date is required"],
        },
        // Display order (lower = shown first)
        priority: {
            type: Number,
            default: 10,
            min: [1, "Priority must be at least 1"],
            max: [100, "Priority cannot exceed 100"],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Analytics
        impressions: {
            type: Number,
            default: 0,
        },
        clicks: {
            type: Number,
            default: 0,
        },
        // Metadata
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                delete ret.__v;
                return ret;
            },
        },
    }
);

// Indexes for efficient querying
promotionSchema.index({ isActive: 1, startDate: 1, endDate: 1, priority: 1 });
promotionSchema.index({ createdAt: -1 });

// Virtual: check if promotion is currently live
promotionSchema.virtual("isLive").get(function () {
    if (!this.isActive) return false;
    const now = new Date();
    return now >= this.startDate && now <= this.endDate;
});

// Virtual: click-through rate
promotionSchema.virtual("ctr").get(function () {
    if (this.impressions === 0) return 0;
    return ((this.clicks / this.impressions) * 100).toFixed(2);
});

const Promotion = mongoose.model("Promotion", promotionSchema);
module.exports = Promotion;
