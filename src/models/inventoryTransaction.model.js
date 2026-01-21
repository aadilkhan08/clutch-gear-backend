/**
 * Inventory Transaction Model
 * Track all stock movements
 */
const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
  {
    transactionNumber: {
      type: String,
      unique: true,
    },
    inventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: [true, "Inventory item is required"],
    },
    type: {
      type: String,
      required: true,
      enum: [
        "purchase", // Stock added from supplier
        "sale", // Used in job card
        "return", // Customer return
        "adjustment", // Manual adjustment
        "damage", // Damaged/expired
        "transfer", // Between locations
      ],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    unitPrice: {
      type: Number,
      min: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
    },
    reference: {
      type: { type: String, enum: ["jobcard", "purchase", "manual"] },
      id: mongoose.Schema.Types.ObjectId,
      number: String,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    supplier: {
      name: String,
      invoiceNumber: String,
      invoiceDate: Date,
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
inventoryTransactionSchema.index({ inventory: 1, createdAt: -1 });
inventoryTransactionSchema.index({ type: 1 });
inventoryTransactionSchema.index({ "reference.type": 1, "reference.id": 1 });
inventoryTransactionSchema.index({ performedBy: 1 });
inventoryTransactionSchema.index({ createdAt: -1 });

/**
 * Generate transaction number before saving
 */
inventoryTransactionSchema.pre("save", async function (next) {
  if (!this.transactionNumber) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const count = await mongoose.model("InventoryTransaction").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    this.transactionNumber = `INV${dateStr}${String(count + 1).padStart(
      4,
      "0"
    )}`;
  }
  next();
});

const InventoryTransaction = mongoose.model(
  "InventoryTransaction",
  inventoryTransactionSchema
);

module.exports = InventoryTransaction;
