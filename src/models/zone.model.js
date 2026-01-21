/**
 * Zone Model
 * Defines geographical zones for car washing operations
 */
const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Zone name is required"],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    vehicleCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
zoneSchema.index({ isActive: 1 });
zoneSchema.index({ name: "text" });

/**
 * Pre-save hook to generate code from name if not provided
 */
zoneSchema.pre("save", function (next) {
  if (!this.code && this.name) {
    this.code = this.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 6);
  }
  next();
});

/**
 * Static: Get all active zones with area and vehicle counts
 */
zoneSchema.statics.getActiveZones = async function () {
  const Area = mongoose.model("Area");

  const zones = await this.find({ isActive: true }).lean();

  // Get area counts for each zone
  const areaCounts = await Area.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$zone", count: { $sum: 1 } } },
  ]);

  const areaCountMap = {};
  areaCounts.forEach((a) => {
    areaCountMap[a._id.toString()] = a.count;
  });

  return zones.map((z) => ({
    ...z,
    areaCount: areaCountMap[z._id.toString()] || 0,
  }));
};

const Zone = mongoose.model("Zone", zoneSchema);

module.exports = Zone;
