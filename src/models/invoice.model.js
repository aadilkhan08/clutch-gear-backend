/**
 * Invoice Model
 * Represents a finalized bill for a job card
 */
const mongoose = require("mongoose");

// Invoice item schema for line items
const invoiceItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["service", "labour", "part", "consumable", "external"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    hsnCode: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    // Spare part specific fields (only applicable when type = "part")
    partNumber: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    // Warranty information for parts
    warranty: {
      period: {
        type: Number, // Duration in months
        min: 0,
      },
      startDate: Date,
      endDate: Date,
      terms: {
        type: String,
        trim: true,
      },
    },
    // Whether the part is OEM or aftermarket
    isOEM: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
    },
    jobCard: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCard",
      required: [true, "Job card is required"],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer is required"],
    },
    garage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Garage",
    },
    // Customer snapshot for invoice permanence
    customerSnapshot: {
      name: String,
      mobile: String,
      email: String,
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
      },
      gstin: String,
    },
    // Vehicle snapshot
    vehicleSnapshot: {
      vehicleNumber: String,
      brand: String,
      model: String,
      year: Number,
      color: String,
    },
    // Line items
    items: [invoiceItemSchema],
    // Billing summary
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountReason: {
      type: String,
      trim: true,
    },
    coupon: {
      code: String,
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
      discountType: String,
      discountValue: Number,
      discountAmount: Number,
    },
    taxableAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Tax breakdown
    cgstRate: {
      type: Number,
      default: 9,
    },
    cgstAmount: {
      type: Number,
      default: 0,
    },
    sgstRate: {
      type: Number,
      default: 9,
    },
    sgstAmount: {
      type: Number,
      default: 0,
    },
    totalTax: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    // Payment tracking
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Status
    status: {
      type: String,
      enum: ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED", "REFUNDED"],
      default: "DRAFT",
    },
    // Terms and notes
    terms: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Timestamps
    issuedAt: Date,
    dueDate: Date,
    paidAt: Date,
    cancelledAt: Date,
    // Metadata
    jobNumber: String,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
invoiceSchema.index({ customer: 1, createdAt: -1 });
invoiceSchema.index({ jobCard: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ issuedAt: -1 });

// Pre-save: Generate invoice number
invoiceSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    // Get count for this month
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), 1),
        $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
      },
    });

    this.invoiceNumber = `INV${year}${month}${(count + 1)
      .toString()
      .padStart(4, "0")}`;
  }

  // Calculate balance
  this.balanceAmount = Math.max(0, this.grandTotal - this.paidAmount);

  // Update status based on payment
  if (this.status !== "CANCELLED" && this.status !== "REFUNDED") {
    if (this.paidAmount >= this.grandTotal) {
      this.status = "PAID";
      if (!this.paidAt) {
        this.paidAt = new Date();
      }
    } else if (this.paidAmount > 0) {
      this.status = "PARTIALLY_PAID";
    }
  }

  next();
});

/**
 * Get invoice with payment summary
 */
invoiceSchema.statics.getWithPayments = async function (invoiceId) {
  const Payment = mongoose.model("Payment");

  const invoice = await this.findById(invoiceId)
    .populate("customer", "name mobile email")
    .populate("jobCard", "jobNumber status")
    .lean();

  if (!invoice) return null;

  // Get all payments for the related job card
  const payments = await Payment.find({
    jobCard: invoice.jobCard._id,
    status: "completed",
  })
    .select("paymentNumber amount paymentMethod createdAt transactionId")
    .sort({ createdAt: 1 })
    .lean();

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    ...invoice,
    payments,
    paidAmount: totalPaid,
    balanceAmount: Math.max(0, invoice.grandTotal - totalPaid),
    isPaid: totalPaid >= invoice.grandTotal,
  };
};

/**
 * Get customer invoices with pagination
 */
invoiceSchema.statics.getCustomerInvoices = async function (
  customerId,
  options = {}
) {
  const { status, page = 1, limit = 10 } = options;

  const query = {
    customer: customerId,
    status: { $nin: ["DRAFT"] }, // Don't show drafts to customers
  };

  if (status && status !== "all") {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    this.find(query)
      .select(
        "invoiceNumber jobNumber vehicleSnapshot grandTotal paidAmount balanceAmount status issuedAt createdAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Create invoice from job card
 */
invoiceSchema.statics.createFromJobCard = async function (jobCard, options = {}) {
  const { generatedBy, terms, notes } = options;

  // Map job items to invoice items
  const items = (jobCard.jobItems || []).map((item) => ({
    type: item.type === "labour" ? "labour" : item.type === "part" ? "part" : "service",
    name: item.description,
    description: item.description,
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    discount: item.discount || 0,
    taxRate: jobCard.billing?.taxRate || 18,
    taxAmount: ((item.total || 0) * (jobCard.billing?.taxRate || 18)) / 100,
    total: item.total || 0,
  }));

  // Customer snapshot
  const customer = jobCard.customer || {};
  const customerSnapshot = {
    name: customer.name,
    mobile: customer.mobile,
    email: customer.email,
    address: customer.address,
    gstin: customer.gstin,
  };

  // Vehicle snapshot
  const vehicleSnapshot = jobCard.vehicleSnapshot || {};

  // Calculate tax breakdown (assuming 18% GST split into CGST/SGST)
  const taxRate = jobCard.billing?.taxRate || 18;
  const taxableAmount = (jobCard.billing?.subtotal || 0) - (jobCard.billing?.discount || 0);
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;
  const cgstAmount = (taxableAmount * cgstRate) / 100;
  const sgstAmount = (taxableAmount * sgstRate) / 100;

  const invoice = new this({
    jobCard: jobCard._id,
    customer: jobCard.customer._id || jobCard.customer,
    garage: jobCard.garage,
    customerSnapshot,
    vehicleSnapshot,
    items,
    subtotal: jobCard.billing?.subtotal || 0,
    discount: jobCard.billing?.discount || 0,
    discountReason: jobCard.billing?.discountReason,
    coupon: jobCard.billing?.coupon,
    taxableAmount,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    totalTax: jobCard.billing?.taxAmount || 0,
    grandTotal: jobCard.billing?.grandTotal || 0,
    jobNumber: jobCard.jobNumber,
    terms: terms || require("../config").garage?.invoiceTerms || "",
    notes,
    generatedBy,
    status: "ISSUED",
    issuedAt: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  await invoice.save();
  return invoice;
};

const Invoice = mongoose.model("Invoice", invoiceSchema);

module.exports = Invoice;
