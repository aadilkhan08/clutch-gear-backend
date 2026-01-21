/**
 * Area Model
 * Defines areas within zones for car washing operations
 */
const mongoose = require("mongoose");

const areaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Area name is required"],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    zone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: [true, "Zone is required"],
    },
    description: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    landmarks: [
      {
        type: String,
        trim: true,
      },
    ],
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
areaSchema.index({ zone: 1 });
areaSchema.index({ isActive: 1 });
areaSchema.index({ zone: 1, name: 1 }, { unique: true });
areaSchema.index({ pincode: 1 });
areaSchema.index({ name: "text", description: "text" });

/**
 * Pre-save hook to generate code from zone and name if not provided
 */
areaSchema.pre("save", async function (next) {
  if (!this.code && this.name) {
    const Zone = mongoose.model("Zone");
    const zone = await Zone.findById(this.zone);
    const zoneCode = zone?.code || "ZN";
    const areaCode = this.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .substring(0, 4);
    this.code = `${zoneCode}-${areaCode}`;
  }
  next();
});

/**
 * Static: Get areas by zone
 */
areaSchema.statics.getByZone = async function (zoneId) {
  return this.find({ zone: zoneId, isActive: true })
    .populate("zone", "name code")
    .sort({ name: 1 });
};

/**
 * Static: Get all areas grouped by zone
 */
areaSchema.statics.getAllGroupedByZone = async function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $lookup: {
        from: "zones",
        localField: "zone",
        foreignField: "_id",
        as: "zoneInfo",
      },
    },
    { $unwind: "$zoneInfo" },
    {
      $group: {
        _id: "$zone",
        zoneName: { $first: "$zoneInfo.name" },
        zoneCode: { $first: "$zoneInfo.code" },
        areas: {
          $push: {
            _id: "$_id",
            name: "$name",
            code: "$code",
            vehicleCount: "$vehicleCount",
          },
        },
        totalVehicles: { $sum: "$vehicleCount" },
      },
    },
    { $sort: { zoneName: 1 } },
  ]);
};

const Area = mongoose.model("Area", areaSchema);

module.exports = Area;
