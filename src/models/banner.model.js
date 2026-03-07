/**
 * Banner Model
 * Single promotional banner displayed on customer home screen
 * Managed exclusively by admin
 */
const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Banner title is required"],
            trim: true,
            maxlength: [120, "Title cannot exceed 120 characters"],
        },
        subtitle: {
            type: String,
            trim: true,
            maxlength: [200, "Subtitle cannot exceed 200 characters"],
        },
        image: {
            url: { type: String, required: [true, "Banner image URL is required"] },
            fileId: { type: String },
            thumbnailUrl: { type: String },
        },
        // Optional link when banner is tapped
        linkType: {
            type: String,
            enum: ["service", "url", "booking", "none"],
            default: "none",
        },
        linkValue: {
            type: String,
            trim: true,
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

bannerSchema.index({ isActive: 1, createdAt: -1 });

const Banner = mongoose.model("Banner", bannerSchema);
module.exports = Banner;
