/**
 * Partner Model
 * Partnership / sponsorship brands displayed to customers
 */
const mongoose = require("mongoose");

const partnerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Partner name is required"],
            trim: true,
            maxlength: [100, "Name cannot exceed 100 characters"],
        },
        subtitle: {
            type: String,
            trim: true,
            maxlength: [100, "Subtitle cannot exceed 100 characters"],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [300, "Description cannot exceed 300 characters"],
        },
        logo: {
            url: { type: String },
            fileId: { type: String },
            thumbnailUrl: { type: String },
        },
        logoText: {
            type: String,
            trim: true,
            maxlength: [20, "Logo text cannot exceed 20 characters"],
        },
        logoColor: {
            type: String,
            trim: true,
            default: "#DC2626",
        },
        bgColor: {
            type: String,
            trim: true,
            default: "#FEF2F2",
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

partnerSchema.index({ isActive: 1, priority: 1 });
partnerSchema.index({ createdAt: -1 });

const Partner = mongoose.model("Partner", partnerSchema);
module.exports = Partner;
