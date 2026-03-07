/**
 * Testimonial Model
 * Video testimonials from satisfied customers, managed by admin
 */
const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
    {
        customerName: {
            type: String,
            required: [true, "Customer name is required"],
            trim: true,
            maxlength: [100, "Customer name cannot exceed 100 characters"],
        },
        customerImage: {
            url: { type: String },
            fileId: { type: String },
            thumbnailUrl: { type: String },
        },
        video: {
            url: { type: String, required: [true, "Video URL is required"] },
            fileId: { type: String },
            thumbnailUrl: { type: String },
        },
        caption: {
            type: String,
            trim: true,
            maxlength: [200, "Caption cannot exceed 200 characters"],
        },
        rating: {
            type: Number,
            min: [1, "Rating must be at least 1"],
            max: [5, "Rating cannot exceed 5"],
            default: 5,
        },
        serviceName: {
            type: String,
            trim: true,
            maxlength: [100, "Service name cannot exceed 100 characters"],
        },
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

testimonialSchema.index({ isActive: 1, priority: 1 });
testimonialSchema.index({ createdAt: -1 });

const Testimonial = mongoose.model("Testimonial", testimonialSchema);
module.exports = Testimonial;
