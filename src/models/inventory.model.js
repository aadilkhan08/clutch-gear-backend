/**
 * Inventory Model
 * Spare parts and consumables management
 */
const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "spare-part",
        "consumable",
        "accessory",
        "lubricant",
        "filter",
        "battery",
        "tyre",
        "brake",
        "electrical",
        "tool",
        "other",
      ],
    },
    brand: {
      type: String,
      trim: true,
    },
    partNumber: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    unit: {
      type: String,
      default: "piece",
      enum: ["piece", "liter", "kg", "set", "pair", "meter", "ml", "gram"],
    },
    currentStock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    minStock: {
      type: Number,
      default: 5,
      min: [0, "Minimum stock cannot be negative"],
    },
    maxStock: {
      type: Number,
      default: 100,
    },
    costPrice: {
      type: Number,
      required: [true, "Cost price is required"],
      min: [0, "Cost price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },
    mrp: {
      type: Number,
      min: [0, "MRP cannot be negative"],
    },
    taxRate: {
      type: Number,
      default: 18,
      min: [0, "Tax rate cannot be negative"],
    },
    location: {
      rack: String,
      shelf: String,
      bin: String,
    },
    vehicleCompatibility: {
      vehicleTypes: [
        {
          type: String,
          enum: ["car", "bike", "scooter", "auto", "truck", "bus", "all"],
        },
      ],
      brands: [String],
      models: [String],
    },
    supplier: {
      name: String,
      contact: String,
      email: String,
      leadTime: Number, // days
    },
    images: [
      {
        url: String,
        fileId: String,
      },
    ],
    warranty: {
      hasWarranty: { type: Boolean, default: false },
      period: {
        value: Number,
        unit: { type: String, enum: ["days", "months", "years"] },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastRestocked: Date,
    lastUsed: Date,
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
inventorySchema.index({ name: "text", description: "text" });
inventorySchema.index({ category: 1 });
inventorySchema.index({ currentStock: 1, minStock: 1 });
inventorySchema.index({ isActive: 1 });
inventorySchema.index({ "supplier.name": 1 });

/**
 * Check if item is low on stock
 */
inventorySchema.virtual("isLowStock").get(function () {
  return this.currentStock <= this.minStock;
});

/**
 * Check if item is out of stock
 */
inventorySchema.virtual("isOutOfStock").get(function () {
  return this.currentStock === 0;
});

/**
 * Calculate profit margin
 */
inventorySchema.virtual("profitMargin").get(function () {
  if (this.costPrice === 0) return 0;
  return ((this.sellingPrice - this.costPrice) / this.costPrice) * 100;
});

/**
 * Generate SKU before saving
 */
inventorySchema.pre("save", async function (next) {
  if (!this.sku) {
    const categoryPrefix = this.category.substring(0, 3).toUpperCase();
    const count = await mongoose.model("Inventory").countDocuments();
    this.sku = `${categoryPrefix}${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

/**
 * Update stock level
 */
inventorySchema.methods.updateStock = async function (quantity, operation) {
  if (operation === "add") {
    this.currentStock += quantity;
    this.lastRestocked = new Date();
  } else if (operation === "deduct") {
    if (this.currentStock < quantity) {
      throw new Error("Insufficient stock");
    }
    this.currentStock -= quantity;
    this.lastUsed = new Date();
  }
  await this.save();
  return this;
};

/**
 * Static: Get low stock items
 */
inventorySchema.statics.getLowStockItems = async function () {
  return this.find({
    $expr: { $lte: ["$currentStock", "$minStock"] },
    isActive: true,
  }).lean();
};

/**
 * Static: Get stock value
 */
inventorySchema.statics.getTotalStockValue = async function () {
  const result = await this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalCostValue: {
          $sum: { $multiply: ["$currentStock", "$costPrice"] },
        },
        totalSellingValue: {
          $sum: { $multiply: ["$currentStock", "$sellingPrice"] },
        },
        totalItems: { $sum: 1 },
        totalStock: { $sum: "$currentStock" },
      },
    },
  ]);
  return (
    result[0] || {
      totalCostValue: 0,
      totalSellingValue: 0,
      totalItems: 0,
      totalStock: 0,
    }
  );
};

inventorySchema.set("toJSON", { virtuals: true });

const Inventory = mongoose.model("Inventory", inventorySchema);

module.exports = Inventory;
