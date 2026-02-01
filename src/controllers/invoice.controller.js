/**
 * Invoice Controller
 * Handles invoice operations for customers and admins
 */
const Invoice = require("../models/invoice.model");
const JobCard = require("../models/jobcard.model");
const Payment = require("../models/payment.model");
const { asyncHandler, ApiError, ApiResponse } = require("../utils");
const { generateInvoicePDF } = require("../services/pdf.service");
const { notificationService } = require("../services");

/**
 * @desc    Get customer invoices
 * @route   GET /api/v1/invoices
 * @access  Private/Customer
 */
const getInvoices = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const result = await Invoice.getCustomerInvoices(req.user._id, {
    status,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  ApiResponse.success(res, "Invoices retrieved", result.invoices, {
    pagination: result.pagination,
  });
});

/**
 * @desc    Get single invoice detail
 * @route   GET /api/v1/invoices/:id
 * @access  Private/Customer
 */
const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.getWithPayments(req.params.id);

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  // Check ownership
  if (invoice.customer._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Access denied");
  }

  ApiResponse.success(res, "Invoice retrieved", invoice);
});

/**
 * @desc    Get invoice by job card
 * @route   GET /api/v1/invoices/job-card/:jobCardId
 * @access  Private/Customer
 */
const getInvoiceByJobCard = asyncHandler(async (req, res) => {
  let invoice = await Invoice.findOne({
    jobCard: req.params.jobCardId,
    status: { $nin: ["DRAFT", "CANCELLED"] },
  })
    .populate("customer", "name mobile email")
    .lean();

  if (!invoice) {
    const jobCard = await JobCard.findOne({
      _id: req.params.jobCardId,
      customer: req.user._id,
    }).populate("customer", "name mobile email address gstin");

    if (!jobCard) {
      throw ApiError.notFound("Invoice not found for this job card");
    }

    if (jobCard.status === "cancelled") {
      throw ApiError.badRequest("Job card is cancelled");
    }

    if (!jobCard.billing) {
      jobCard.billing = {};
    }

    const items = Array.isArray(jobCard.jobItems) ? jobCard.jobItems : [];
    const hasPricedItems = items.some((item) => Number(item?.total || 0) > 0);
    const grandTotal = Number(jobCard.billing?.grandTotal || 0);

    if (hasPricedItems && grandTotal <= 0) {
      jobCard.calculateBilling();
      await jobCard.save();
    }

    if (!jobCard.billing?.grandTotal || jobCard.billing.grandTotal <= 0) {
      throw ApiError.badRequest("Invoice not available yet");
    }

    const createdInvoice = await Invoice.createFromJobCard(jobCard, {
      generatedBy: req.user._id,
    });
    await createdInvoice.populate("customer", "name mobile email");
    invoice = createdInvoice.toObject();
  }

  // Check ownership
  if (invoice.customer._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Access denied");
  }

  // Get payments
  const payments = await Payment.find({
    jobCard: req.params.jobCardId,
    status: "completed",
  })
    .select("paymentNumber amount paymentMethod createdAt transactionId")
    .sort({ createdAt: 1 })
    .lean();

  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  ApiResponse.success(res, "Invoice retrieved", {
    ...invoice,
    payments,
    paidAmount: totalPaid,
    balanceAmount: Math.max(0, invoice.grandTotal - totalPaid),
    isPaid: totalPaid >= invoice.grandTotal,
  });
});

/**
 * @desc    Download invoice PDF
 * @route   GET /api/v1/invoices/:id/pdf
 * @access  Private/Customer
 */
const downloadInvoicePDF = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate("customer", "name mobile email address gstin")
    .populate("jobCard", "jobNumber status")
    .lean();

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  // Check ownership
  if (invoice.customer._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Access denied");
  }

  // Get payments for the job card
  const payments = await Payment.find({
    jobCard: invoice.jobCard._id,
    status: "completed",
  })
    .select("paymentNumber amount paymentMethod createdAt")
    .lean();

  // Prepare data for PDF generation
  const pdfData = {
    invoice,
    payments,
    totalPaid: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
  };

  const pdfBuffer = await generateInvoicePDFFromInvoice(pdfData);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`
  );
  res.send(pdfBuffer);
});

/**
 * Generate invoice PDF from invoice data
 * @param {Object} data - Invoice data with payments
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDFFromInvoice = async (data) => {
  const PDFDocument = require("pdfkit");
  const config = require("../config");

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Invoice ${data.invoice.invoiceNumber}`,
          Author: config.garage?.name || "ClutchGear Auto Services",
        },
      });

      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const { invoice, payments, totalPaid } = data;

      // Colors
      const primaryColor = "#DC2626";
      const textColor = "#0F172A";
      const mutedColor = "#64748B";
      const borderColor = "#E2E8F0";
      const successColor = "#16A34A";

      // Header
      doc
        .fontSize(24)
        .fillColor(primaryColor)
        .font("Helvetica-Bold")
        .text(config.garage?.name || "ClutchGear Auto Services", 50, 50);

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(config.garage?.address || "Vehicle Service Center", 50, 80)
        .text(config.garage?.phone || "", 50, 95)
        .text(config.garage?.email || "", 50, 110);

      if (config.garage?.gstin) {
        doc.text(`GSTIN: ${config.garage.gstin}`, 50, 125);
      }

      // Invoice Title & Status
      doc
        .fontSize(28)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text("TAX INVOICE", 350, 50, { align: "right" });

      // Status badge
      const statusColors = {
        PAID: successColor,
        PARTIALLY_PAID: "#F59E0B",
        ISSUED: "#3B82F6",
        CANCELLED: "#EF4444",
      };
      const statusColor = statusColors[invoice.status] || mutedColor;
      doc
        .fontSize(12)
        .fillColor(statusColor)
        .font("Helvetica-Bold")
        .text(invoice.status.replace("_", " "), 350, 82, { align: "right" });

      // Invoice details
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Invoice No:", 350, 105, { align: "right" });
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(invoice.invoiceNumber, 350, 120, { align: "right" });

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Date:", 350, 140, { align: "right" });
      doc
        .fontSize(10)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(
          new Date(invoice.issuedAt || invoice.createdAt).toLocaleDateString(
            "en-IN"
          ),
          350,
          155,
          { align: "right" }
        );

      if (invoice.jobNumber) {
        doc
          .fontSize(10)
          .fillColor(mutedColor)
          .font("Helvetica")
          .text("Job No:", 350, 175, { align: "right" });
        doc
          .fontSize(10)
          .fillColor(textColor)
          .font("Helvetica-Bold")
          .text(invoice.jobNumber, 350, 190, { align: "right" });
      }

      // Divider
      doc.moveTo(50, 215).lineTo(545, 215).strokeColor(borderColor).stroke();

      // Bill To
      let yPos = 235;
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica-Bold")
        .text("BILL TO:", 50, yPos);

      yPos += 18;
      const customer = invoice.customerSnapshot || invoice.customer || {};
      doc
        .fontSize(12)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(customer.name || "Customer", 50, yPos);

      yPos += 16;
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(customer.mobile || "", 50, yPos);

      if (customer.email) {
        yPos += 14;
        doc.text(customer.email, 50, yPos);
      }

      if (customer.gstin) {
        yPos += 14;
        doc.text(`GSTIN: ${customer.gstin}`, 50, yPos);
      }

      // Vehicle
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica-Bold")
        .text("VEHICLE:", 350, 235);

      const vehicle = invoice.vehicleSnapshot || {};
      doc
        .fontSize(12)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text(vehicle.vehicleNumber || "N/A", 350, 253);

      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(
          `${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "N/A",
          350,
          271
        );

      // Items Table Header
      yPos = 320;
      doc.rect(50, yPos, 495, 25).fillColor("#F8FAFC").fill();

      doc
        .fontSize(9)
        .fillColor(mutedColor)
        .font("Helvetica-Bold")
        .text("DESCRIPTION", 60, yPos + 8)
        .text("HSN", 280, yPos + 8, { width: 40 })
        .text("QTY", 320, yPos + 8, { width: 30, align: "center" })
        .text("RATE", 360, yPos + 8, { width: 60, align: "right" })
        .text("AMOUNT", 440, yPos + 8, { width: 90, align: "right" });

      // Items
      yPos += 30;
      const items = invoice.items || [];

      items.forEach((item) => {
        if (yPos > 680) {
          doc.addPage();
          yPos = 50;
        }

        const typeIcon =
          item.type === "part"
            ? "🔧"
            : item.type === "labour"
              ? "👨‍🔧"
              : "🛠️";

        doc
          .fontSize(10)
          .fillColor(textColor)
          .font("Helvetica")
          .text(`${typeIcon} ${item.name}`, 60, yPos, { width: 210 })
          .text(item.hsnCode || "-", 280, yPos, { width: 40 })
          .text(String(item.quantity || 1), 320, yPos, {
            width: 30,
            align: "center",
          })
          .text(`₹${(item.unitPrice || 0).toLocaleString("en-IN")}`, 360, yPos, {
            width: 60,
            align: "right",
          })
          .text(`₹${(item.total || 0).toLocaleString("en-IN")}`, 440, yPos, {
            width: 90,
            align: "right",
          });

        yPos += 22;
      });

      // Summary section
      yPos = Math.max(yPos + 20, 500);
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor(borderColor).stroke();

      yPos += 15;
      const summaryX = 380;
      const valueX = 530;

      // Subtotal
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text("Subtotal:", summaryX, yPos);
      doc
        .fillColor(textColor)
        .text(`₹${(invoice.subtotal || 0).toLocaleString("en-IN")}`, valueX, yPos, {
          align: "right",
          width: 60,
        });

      // Discount
      if (invoice.discount > 0) {
        yPos += 18;
        doc.fillColor(mutedColor).text("Discount:", summaryX, yPos);
        doc
          .fillColor(successColor)
          .text(
            `-₹${(invoice.discount || 0).toLocaleString("en-IN")}`,
            valueX,
            yPos,
            { align: "right", width: 60 }
          );
      }

      // Tax breakdown
      if (invoice.cgstAmount > 0) {
        yPos += 18;
        doc
          .fillColor(mutedColor)
          .text(`CGST (${invoice.cgstRate}%):`, summaryX, yPos);
        doc
          .fillColor(textColor)
          .text(
            `₹${(invoice.cgstAmount || 0).toLocaleString("en-IN")}`,
            valueX,
            yPos,
            { align: "right", width: 60 }
          );
      }

      if (invoice.sgstAmount > 0) {
        yPos += 18;
        doc
          .fillColor(mutedColor)
          .text(`SGST (${invoice.sgstRate}%):`, summaryX, yPos);
        doc
          .fillColor(textColor)
          .text(
            `₹${(invoice.sgstAmount || 0).toLocaleString("en-IN")}`,
            valueX,
            yPos,
            { align: "right", width: 60 }
          );
      }

      // Grand Total
      yPos += 25;
      doc.rect(summaryX - 10, yPos - 5, 160, 28).fillColor("#F8FAFC").fill();
      doc
        .fontSize(12)
        .fillColor(textColor)
        .font("Helvetica-Bold")
        .text("Grand Total:", summaryX, yPos + 3);
      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text(
          `₹${(invoice.grandTotal || 0).toLocaleString("en-IN")}`,
          valueX,
          yPos + 2,
          { align: "right", width: 60 }
        );

      // Payment status
      yPos += 35;
      if (totalPaid > 0) {
        doc
          .fontSize(10)
          .fillColor(successColor)
          .font("Helvetica")
          .text("Amount Paid:", summaryX, yPos);
        doc.text(`₹${totalPaid.toLocaleString("en-IN")}`, valueX, yPos, {
          align: "right",
          width: 60,
        });

        const balance = invoice.grandTotal - totalPaid;
        if (balance > 0) {
          yPos += 18;
          doc.fillColor(primaryColor).text("Balance Due:", summaryX, yPos);
          doc.text(`₹${balance.toLocaleString("en-IN")}`, valueX, yPos, {
            align: "right",
            width: 60,
          });
        }
      }

      // Payment history (if exists)
      if (payments && payments.length > 0) {
        yPos += 40;
        doc
          .fontSize(11)
          .fillColor(textColor)
          .font("Helvetica-Bold")
          .text("Payment History", 50, yPos);

        yPos += 18;
        payments.forEach((payment) => {
          doc
            .fontSize(9)
            .fillColor(mutedColor)
            .font("Helvetica")
            .text(
              `${new Date(payment.createdAt).toLocaleDateString("en-IN")} - ${payment.paymentMethod || "Online"
              }`,
              50,
              yPos
            );
          doc
            .fillColor(successColor)
            .text(`₹${(payment.amount || 0).toLocaleString("en-IN")}`, 250, yPos);
          yPos += 14;
        });
      }

      // Terms
      if (invoice.terms) {
        yPos = Math.max(yPos + 30, 720);
        if (yPos > 750) {
          doc.addPage();
          yPos = 50;
        }
        doc
          .fontSize(9)
          .fillColor(mutedColor)
          .font("Helvetica-Bold")
          .text("Terms & Conditions:", 50, yPos);
        yPos += 14;
        doc.font("Helvetica").text(invoice.terms, 50, yPos, { width: 450 });
      }

      // Footer
      doc
        .fontSize(8)
        .fillColor(mutedColor)
        .text(
          "Thank you for your business!",
          50,
          780,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ==================== ADMIN CONTROLLERS ====================

/**
 * @desc    Get all invoices (Admin)
 * @route   GET /api/v1/admin/invoices
 * @access  Private/Admin
 */
const getInvoicesAdmin = asyncHandler(async (req, res) => {
  const {
    status,
    customerId,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query;

  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (customerId) {
    query.customer = customerId;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [invoices, total] = await Promise.all([
    Invoice.find(query)
      .populate("customer", "name mobile")
      .select(
        "invoiceNumber jobNumber customerSnapshot.name vehicleSnapshot.vehicleNumber grandTotal paidAmount balanceAmount status issuedAt createdAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Invoice.countDocuments(query),
  ]);

  ApiResponse.success(res, "Invoices retrieved", invoices, {
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * @desc    Get invoice detail (Admin)
 * @route   GET /api/v1/admin/invoices/:id
 * @access  Private/Admin
 */
const getInvoiceAdmin = asyncHandler(async (req, res) => {
  const invoice = await Invoice.getWithPayments(req.params.id);

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  ApiResponse.success(res, "Invoice retrieved", invoice);
});

/**
 * @desc    Generate invoice from job card
 * @route   POST /api/v1/admin/jobcards/:id/generate-invoice
 * @access  Private/Admin
 */
const generateInvoiceFromJobCard = asyncHandler(async (req, res) => {
  const { terms, notes } = req.body;

  const jobCard = await JobCard.findById(req.params.id)
    .populate("customer", "name mobile email address gstin")
    .lean();

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  // Check if invoice already exists
  const existingInvoice = await Invoice.findOne({
    jobCard: jobCard._id,
    status: { $nin: ["CANCELLED"] },
  });

  if (existingInvoice) {
    throw ApiError.badRequest("Invoice already exists for this job card");
  }

  // Check if job card has billing
  if (!jobCard.billing || !jobCard.billing.grandTotal) {
    throw ApiError.badRequest("Job card has no billing information");
  }

  const invoice = await Invoice.createFromJobCard(jobCard, {
    generatedBy: req.user._id,
    terms,
    notes,
  });

  await invoice.populate("customer", "name mobile email");

  ApiResponse.created(res, "Invoice generated", invoice);
});

/**
 * @desc    Cancel invoice (Admin)
 * @route   PUT /api/v1/admin/invoices/:id/cancel
 * @access  Private/Admin
 */
const cancelInvoice = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  if (invoice.status === "PAID" || invoice.paidAmount > 0) {
    throw ApiError.badRequest("Cannot cancel invoice with payments");
  }

  invoice.status = "CANCELLED";
  invoice.cancelledAt = new Date();
  await invoice.save();

  ApiResponse.success(res, "Invoice cancelled", invoice);
});

/**
 * @desc    Download invoice PDF (Admin)
 * @route   GET /api/v1/admin/invoices/:id/pdf
 * @access  Private/Admin
 */
const downloadInvoicePDFAdmin = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
    .populate("customer", "name mobile email address gstin")
    .populate("jobCard", "jobNumber status")
    .lean();

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  const payments = await Payment.find({
    jobCard: invoice.jobCard._id,
    status: "completed",
  })
    .select("paymentNumber amount paymentMethod createdAt")
    .lean();

  const pdfData = {
    invoice,
    payments,
    totalPaid: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
  };

  const pdfBuffer = await generateInvoicePDFFromInvoice(pdfData);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`
  );
  res.send(pdfBuffer);
});

/**
 * @desc    Update invoice payment status (called when payment completes)
 * @param   {String} jobCardId - Job card ID
 */
const updateInvoicePaymentStatus = async (jobCardId) => {
  const invoice = await Invoice.findOne({
    jobCard: jobCardId,
    status: { $nin: ["CANCELLED", "REFUNDED"] },
  });

  if (!invoice) return;

  const payments = await Payment.getJobCardPayments(jobCardId);
  invoice.paidAmount = payments.totalPaid;
  await invoice.save(); // Pre-save hook updates status
};

/**
 * @desc    Create Razorpay order for invoice payment
 * @route   POST /api/v1/invoices/:id/payment/order
 * @access  Private/Customer
 */
const createPaymentOrder = asyncHandler(async (req, res) => {
  const razorpayService = require("../services/razorpay.service");

  // Get invoice with payment details
  const invoice = await Invoice.getWithPayments(req.params.id);

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  // Check ownership
  if (invoice.customer._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Access denied");
  }

  // Check if invoice is payable
  if (invoice.paymentStatus === "PAID") {
    throw ApiError.badRequest("Invoice is already fully paid");
  }

  if (invoice.status === "CANCELLED" || invoice.status === "REFUNDED") {
    throw ApiError.badRequest("Cannot pay for a cancelled or refunded invoice");
  }

  // Get amount from request or use balance
  let amount = req.body.amount;
  const balanceAmount = invoice.grandTotal - (invoice.paidAmount || 0);

  if (!amount || amount <= 0) {
    amount = balanceAmount;
  }

  // Validate amount
  if (amount > balanceAmount) {
    throw ApiError.badRequest(
      `Amount cannot exceed balance of ₹${balanceAmount.toFixed(2)}`
    );
  }

  if (amount < 1) {
    throw ApiError.badRequest("Minimum payment amount is ₹1");
  }

  // Create Razorpay order
  const receipt = `INV_${invoice.invoiceNumber}_${Date.now()}`;
  const order = await razorpayService.createOrder(amount, receipt, {
    invoiceId: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    customerId: req.user._id.toString(),
    jobCardId: invoice.jobCard._id?.toString() || invoice.jobCard.toString(),
  });

  ApiResponse.success(res, "Payment order created", {
    orderId: order.id,
    amount: order.amount / 100, // Convert back to INR
    currency: order.currency,
    keyId: razorpayService.getKeyId(),
    invoiceNumber: invoice.invoiceNumber,
    invoiceId: invoice._id,
    balanceAmount,
  });
});

/**
 * @desc    Verify payment and update invoice
 * @route   POST /api/v1/invoices/:id/payment/verify
 * @access  Private/Customer
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const razorpayService = require("../services/razorpay.service");
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  // Validate required fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw ApiError.badRequest("Missing payment verification details");
  }

  // Get invoice
  const invoice = await Invoice.findById(req.params.id).populate(
    "jobCard",
    "jobNumber"
  );

  if (!invoice) {
    throw ApiError.notFound("Invoice not found");
  }

  // Check ownership
  if (invoice.customer.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Access denied");
  }

  // Verify signature
  const isValid = razorpayService.verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    throw ApiError.badRequest("Payment verification failed");
  }

  // Fetch payment details from Razorpay
  const razorpayPayment = await razorpayService.fetchPayment(razorpay_payment_id);
  const paidAmount = razorpayPayment.amount / 100; // Convert from paise

  // Determine payment method
  let paymentMethod = "other";
  if (razorpayPayment.method === "upi") {
    paymentMethod = "upi";
  } else if (razorpayPayment.method === "card") {
    paymentMethod = "card";
  } else if (razorpayPayment.method === "netbanking") {
    paymentMethod = "netbanking";
  } else if (razorpayPayment.method === "wallet") {
    paymentMethod = "wallet";
  }

  // Generate payment number
  const paymentCount = await Payment.countDocuments();
  const paymentNumber = `PAY${String(paymentCount + 1).padStart(6, "0")}`;

  const remainingBeforePayment = Math.max(
    0,
    Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)
  );
  const paymentType = paidAmount >= remainingBeforePayment ? "full" : "partial";

  // Create payment record
  const payment = await Payment.create({
    paymentNumber,
    customer: req.user._id,
    jobCard: invoice.jobCard._id || invoice.jobCard,
    amount: paidAmount,
    paymentType,
    paymentMethod,
    status: "completed",
    transactionId: razorpay_payment_id,
    metadata: {
      razorpay_order_id,
      razorpay_signature,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      method_details: razorpayPayment.method,
      vpa: razorpayPayment.vpa, // For UPI
      bank: razorpayPayment.bank, // For netbanking
      wallet: razorpayPayment.wallet, // For wallet
    },
  });

  // Update invoice paid amount
  invoice.paidAmount = (invoice.paidAmount || 0) + paidAmount;

  // Determine payment status
  if (invoice.paidAmount >= invoice.grandTotal) {
    invoice.paymentStatus = "PAID";
  } else if (invoice.paidAmount > 0) {
    invoice.paymentStatus = "PARTIAL";
  }

  await invoice.save();

  // Send payment success notification
  try {
    await notificationService.sendPaymentSuccess(req.user._id, payment);
  } catch (error) {
    console.error("Payment notification failed:", error);
  }

  // Return updated invoice details
  const updatedInvoice = await Invoice.getWithPayments(invoice._id);

  ApiResponse.success(res, "Payment verified successfully", {
    payment: {
      _id: payment._id,
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      createdAt: payment.createdAt,
    },
    invoice: {
      _id: updatedInvoice._id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      grandTotal: updatedInvoice.grandTotal,
      paidAmount: updatedInvoice.paidAmount,
      balanceAmount: updatedInvoice.grandTotal - updatedInvoice.paidAmount,
      paymentStatus: updatedInvoice.paymentStatus,
    },
  });
});

module.exports = {
  // Customer
  getInvoices,
  getInvoice,
  getInvoiceByJobCard,
  downloadInvoicePDF,
  createPaymentOrder,
  verifyPayment,
  // Admin
  getInvoicesAdmin,
  getInvoiceAdmin,
  generateInvoiceFromJobCard,
  cancelInvoice,
  downloadInvoicePDFAdmin,
  // Utility
  updateInvoicePaymentStatus,
};
