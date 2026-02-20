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
    const jobCard = await JobCard.findById(req.params.jobCardId).populate(
      "customer",
      "name mobile email address gstin"
    );

    if (!jobCard) {
      throw ApiError.notFound("Invoice not found for this job card");
    }

    const jobCardCustomerId = jobCard.customer?._id || jobCard.customer;
    if (
      !jobCardCustomerId ||
      jobCardCustomerId.toString() !== req.user._id.toString()
    ) {
      throw ApiError.forbidden("Access denied");
    }

    if (jobCard.status === "cancelled") {
      throw ApiError.badRequest("Job card is cancelled");
    }

    if (!jobCard.billing) {
      jobCard.billing = {};
    }

    const items = Array.isArray(jobCard.jobItems) ? jobCard.jobItems : [];
    const hasPricedItems = items.some((item) => Number(item?.total || 0) > 0);
    let grandTotal = Number(jobCard.billing?.grandTotal || 0);

    if (hasPricedItems && grandTotal <= 0) {
      jobCard.calculateBilling();
      await jobCard.save();
      grandTotal = Number(jobCard.billing?.grandTotal || 0);
    }

    if (grandTotal <= 0 && jobCard.estimate?.grandTotal > 0) {
      const estimate = jobCard.estimate;

      if (!items.length && Array.isArray(estimate.items)) {
        jobCard.jobItems = estimate.items.map((item) => ({
          type: item.type,
          description: item.name || item.description || "Service",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          total: item.total || 0,
          isApproved: true,
          approvedAt: new Date(),
        }));
      }

      jobCard.billing.subtotal = estimate.subtotal || 0;
      jobCard.billing.discount = estimate.discountAmount || 0;
      jobCard.billing.discountReason = estimate.discountReason || "";
      jobCard.billing.taxRate = estimate.taxRate || 0;
      jobCard.billing.taxAmount = estimate.taxAmount || 0;
      jobCard.billing.grandTotal = estimate.grandTotal || 0;

      await jobCard.save();
      grandTotal = Number(jobCard.billing?.grandTotal || 0);
    }

    if (!grandTotal || grandTotal <= 0) {
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

  // Block PDF download when invoice is not fully paid
  if (invoice.status !== "PAID") {
    throw ApiError.badRequest(
      "Invoice PDF can only be downloaded after full payment"
    );
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
        margin: 0,
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

      // ── Design tokens ──
      const primaryColor = "#DC2626";
      const primaryDark = "#B91C1C";
      const textColor = "#0F172A";
      const mutedColor = "#64748B";
      const lightMuted = "#94A3B8";
      const borderColor = "#E2E8F0";
      const successColor = "#10B981";
      const bgLight = "#F8FAFC";
      const bgLighter = "#F1F5F9";

      const pageW = 595.28; // A4 width
      const marginX = 50;
      const contentW = pageW - marginX * 2;

      const fmtCurrency = (n) =>
        `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const fmtDate = (d) => {
        if (!d) return "—";
        const dt = new Date(d);
        const day = String(dt.getDate()).padStart(2, "0");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${day}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
      };

      // ══════════════════════════════════════════
      //  TOP RED ACCENT STRIP
      // ══════════════════════════════════════════
      doc.rect(0, 0, pageW, 6).fill(primaryColor);

      // ══════════════════════════════════════════
      //  BILL CARD BACKGROUND
      // ══════════════════════════════════════════
      doc.rect(marginX - 10, 20, contentW + 20, 760).lineWidth(0.5).strokeColor(borderColor).fillColor("#FFFFFF").fillAndStroke();

      // ══════════════════════════════════════════
      //  HEADER — Brand + Status Badge
      // ══════════════════════════════════════════
      let yPos = 40;

      // Brand icon circle
      doc.circle(marginX + 20, yPos + 14, 18).fillColor(primaryColor + "15").fill();
      doc.fontSize(16).fillColor(primaryColor).font("Helvetica-Bold").text("CG", marginX + 8, yPos + 6);

      // Brand name
      doc.fontSize(18).fillColor(textColor).font("Helvetica-Bold").text(config.garage?.name || "ClutchGear", marginX + 44, yPos);
      doc.fontSize(10).fillColor(lightMuted).font("Helvetica").text("Auto Services", marginX + 44, yPos + 20);

      // Status badge (right side)
      const statusLabels = { PAID: "Paid", PARTIALLY_PAID: "Partial", ISSUED: "Unpaid", CANCELLED: "Cancelled", REFUNDED: "Refunded" };
      const statusBgColors = { PAID: "#10B981", PARTIALLY_PAID: "#F59E0B", ISSUED: "#EF4444", CANCELLED: "#64748B", REFUNDED: "#8B5CF6" };
      const sLabel = statusLabels[invoice.status] || invoice.status;
      const sBg = statusBgColors[invoice.status] || mutedColor;
      const badgeW = doc.widthOfString(sLabel, { fontSize: 10 }) + 24;
      const badgeX = pageW - marginX - badgeW - 10;
      doc.roundedRect(badgeX, yPos + 2, badgeW, 24, 12).fillColor(sBg).fill();
      doc.fontSize(10).fillColor("#FFFFFF").font("Helvetica-Bold").text(sLabel, badgeX, yPos + 8, { width: badgeW, align: "center" });

      // ══════════════════════════════════════════
      //  TAX INVOICE DIVIDER
      // ══════════════════════════════════════════
      yPos = 80;
      const divLabel = "TAX INVOICE";
      const divLabelW = doc.widthOfString(divLabel, { fontSize: 9 });
      const divCenter = pageW / 2;
      doc.moveTo(marginX, yPos).lineTo(divCenter - divLabelW / 2 - 10, yPos).strokeColor(borderColor).lineWidth(0.5).stroke();
      doc.fontSize(9).fillColor(lightMuted).font("Helvetica-Bold").text(divLabel, divCenter - divLabelW / 2, yPos - 4);
      doc.moveTo(divCenter + divLabelW / 2 + 10, yPos).lineTo(pageW - marginX, yPos).strokeColor(borderColor).lineWidth(0.5).stroke();

      // ══════════════════════════════════════════
      //  INVOICE META ROW
      // ══════════════════════════════════════════
      yPos = 95;
      const colW = contentW / 3;

      // Invoice No.
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("INVOICE NO.", marginX, yPos);
      doc.fontSize(12).fillColor(textColor).font("Helvetica-Bold").text(invoice.invoiceNumber, marginX, yPos + 12);

      // Date
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("DATE", marginX + colW, yPos, { width: colW, align: "center" });
      doc.fontSize(12).fillColor(textColor).font("Helvetica-Bold").text(fmtDate(invoice.issuedAt || invoice.createdAt), marginX + colW, yPos + 12, { width: colW, align: "center" });

      // Job Card
      if (invoice.jobNumber) {
        doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("JOB CARD", marginX + colW * 2, yPos, { width: colW, align: "right" });
        doc.fontSize(12).fillColor(textColor).font("Helvetica-Bold").text(`#${invoice.jobNumber}`, marginX + colW * 2, yPos + 12, { width: colW, align: "right" });
      }

      // ══════════════════════════════════════════
      //  BILL TO / VEHICLE  (on grey background)
      // ══════════════════════════════════════════
      yPos = 135;
      doc.rect(marginX - 10, yPos, contentW + 20, 55).fillColor(bgLight).fill();
      doc.moveTo(marginX - 10, yPos).lineTo(pageW - marginX + 10, yPos).strokeColor(bgLighter).lineWidth(0.5).stroke();

      yPos += 10;
      const customer = invoice.customerSnapshot || invoice.customer || {};
      const vehicle = invoice.vehicleSnapshot || {};

      // Bill To (left)
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("BILL TO", marginX + 5, yPos);
      doc.fontSize(11).fillColor(textColor).font("Helvetica-Bold").text(customer.name || "Customer", marginX + 5, yPos + 12);
      doc.fontSize(9).fillColor(mutedColor).font("Helvetica").text(customer.mobile || "", marginX + 5, yPos + 26);

      // Vehicle (right)
      const rightX = pageW - marginX - 5;
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("VEHICLE", marginX + contentW / 2, yPos, { width: contentW / 2 - 5, align: "right" });
      doc.fontSize(11).fillColor(textColor).font("Helvetica-Bold").text(vehicle.vehicleNumber || "N/A", marginX + contentW / 2, yPos + 12, { width: contentW / 2 - 5, align: "right" });
      doc.fontSize(9).fillColor(mutedColor).font("Helvetica").text(`${vehicle.brand || ""} ${vehicle.model || ""}`.trim() || "", marginX + contentW / 2, yPos + 26, { width: contentW / 2 - 5, align: "right" });

      // ══════════════════════════════════════════
      //  ITEMS TABLE
      // ══════════════════════════════════════════
      yPos = 200;

      // Table header
      doc.rect(marginX - 10, yPos, contentW + 20, 22).fillColor(bgLighter).fill();
      doc.fontSize(8).fillColor(mutedColor).font("Helvetica-Bold")
        .text("DESCRIPTION", marginX, yPos + 7)
        .text("QTY", marginX + 230, yPos + 7, { width: 40, align: "center" })
        .text("RATE", marginX + 300, yPos + 7, { width: 70, align: "right" })
        .text("AMOUNT", marginX + 390, yPos + 7, { width: contentW - 390, align: "right" });

      yPos += 26;
      const items = invoice.items || [];

      // Type color dots
      const typeColors = {
        service: "#3B82F6",
        labour: "#8B5CF6",
        part: "#EF4444",
        consumable: "#10B981",
        external: "#F59E0B",
      };
      const typeLabels = {
        service: "Service",
        labour: "Labour",
        part: "Part",
        consumable: "Consumable",
        external: "External",
      };

      items.forEach((item, idx) => {
        if (yPos > 680) {
          doc.addPage();
          yPos = 50;
        }

        // Alternating stripe
        if (idx % 2 === 0) {
          doc.rect(marginX - 10, yPos - 4, contentW + 20, 32).fillColor("#FAFBFC").fill();
        }

        // Type dot
        const dotColor = typeColors[item.type] || "#64748B";
        doc.circle(marginX + 4, yPos + 6, 3).fillColor(dotColor).fill();

        // Name
        doc.fontSize(10).fillColor(textColor).font("Helvetica-Bold").text(item.name || "Item", marginX + 12, yPos, { width: 210 });
        // Type label
        doc.fontSize(7).fillColor(lightMuted).font("Helvetica").text(typeLabels[item.type] || item.type || "", marginX + 12, yPos + 13);

        // Qty
        doc.fontSize(10).fillColor(textColor).font("Helvetica").text(String(item.quantity || 1), marginX + 230, yPos, { width: 40, align: "center" });
        // Rate
        doc.text(fmtCurrency(item.unitPrice), marginX + 300, yPos, { width: 70, align: "right" });
        // Amount
        doc.font("Helvetica-Bold").text(fmtCurrency(item.total), marginX + 390, yPos, { width: contentW - 390, align: "right" });

        yPos += 32;

        // Row divider
        doc.moveTo(marginX - 10, yPos - 4).lineTo(pageW - marginX + 10, yPos - 4).strokeColor(bgLighter).lineWidth(0.3).stroke();
      });

      if (items.length === 0) {
        doc.fontSize(10).fillColor(mutedColor).font("Helvetica-Oblique").text("No itemized charges", marginX, yPos);
        yPos += 30;
      }

      // ══════════════════════════════════════════
      //  TOTALS
      // ══════════════════════════════════════════
      yPos = Math.max(yPos + 10, 420);
      doc.moveTo(marginX, yPos).lineTo(pageW - marginX, yPos).strokeColor(borderColor).lineWidth(0.5).stroke();

      yPos += 12;
      const labX = marginX + contentW - 210;
      const valX = marginX + contentW - 5;
      const valW = 100;

      // Subtotal
      doc.fontSize(10).fillColor(mutedColor).font("Helvetica").text("Subtotal", labX, yPos);
      doc.fontSize(10).fillColor(textColor).font("Helvetica").text(fmtCurrency(invoice.subtotal), valX - valW, yPos, { width: valW, align: "right" });

      // Discount
      if (invoice.discount > 0) {
        yPos += 18;
        doc.fillColor(mutedColor).text(`Discount${invoice.discountReason ? " (" + invoice.discountReason + ")" : ""}`, labX, yPos);
        doc.fillColor(successColor).text(`-${fmtCurrency(invoice.discount)}`, valX - valW, yPos, { width: valW, align: "right" });
      }

      // CGST
      if (invoice.cgstAmount > 0) {
        yPos += 18;
        doc.fillColor(mutedColor).text(`CGST (${invoice.cgstRate || 9}%)`, labX, yPos);
        doc.fillColor(textColor).text(fmtCurrency(invoice.cgstAmount), valX - valW, yPos, { width: valW, align: "right" });
      }

      // SGST
      if (invoice.sgstAmount > 0) {
        yPos += 18;
        doc.fillColor(mutedColor).text(`SGST (${invoice.sgstRate || 9}%)`, labX, yPos);
        doc.fillColor(textColor).text(fmtCurrency(invoice.sgstAmount), valX - valW, yPos, { width: valW, align: "right" });
      }

      // ── Grand Total ──
      yPos += 24;
      doc.moveTo(labX, yPos).lineTo(valX, yPos).strokeColor(textColor).lineWidth(1.5).stroke();

      yPos += 10;
      doc.fontSize(13).fillColor(textColor).font("Helvetica-Bold").text("Grand Total", labX, yPos);
      doc.fontSize(18).fillColor(textColor).font("Helvetica-Bold").text(fmtCurrency(invoice.grandTotal), valX - valW - 30, yPos - 2, { width: valW + 30, align: "right" });

      // ── Paid / Balance Due Strip ──
      yPos += 35;
      doc.roundedRect(marginX + contentW / 4, yPos, contentW / 2, 38, 8).fillColor(bgLight).fill();

      const stripCenter = marginX + contentW / 2;
      // Paid
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("Paid", stripCenter - 80, yPos + 6, { width: 60, align: "center" });
      doc.fontSize(12).fillColor(successColor).font("Helvetica-Bold").text(fmtCurrency(totalPaid || 0), stripCenter - 80, yPos + 18, { width: 60, align: "center" });

      // Separator dot
      doc.circle(stripCenter, yPos + 19, 2.5).fillColor(borderColor).fill();

      // Balance Due
      const balance = Math.max(0, (invoice.grandTotal || 0) - (totalPaid || 0));
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica-Bold").text("Balance Due", stripCenter + 20, yPos + 6, { width: 80, align: "center" });
      doc.fontSize(12).fillColor(balance > 0 ? primaryColor : successColor).font("Helvetica-Bold").text(fmtCurrency(balance), stripCenter + 20, yPos + 18, { width: 80, align: "center" });

      // ══════════════════════════════════════════
      //  PAYMENT HISTORY
      // ══════════════════════════════════════════
      if (payments && payments.length > 0) {
        yPos += 55;
        if (yPos > 700) { doc.addPage(); yPos = 50; }

        doc.fontSize(11).fillColor(textColor).font("Helvetica-Bold").text("Payment History", marginX, yPos);
        yPos += 18;

        payments.forEach((p) => {
          if (yPos > 740) { doc.addPage(); yPos = 50; }
          doc.fontSize(9).fillColor(mutedColor).font("Helvetica").text(
            `${fmtDate(p.createdAt)}  •  ${(p.paymentMethod || "Online").toUpperCase()}`,
            marginX + 5, yPos
          );
          doc.fontSize(9).fillColor(successColor).font("Helvetica-Bold").text(
            `+${fmtCurrency(p.amount)}`,
            marginX + contentW - 100, yPos, { width: 100, align: "right" }
          );
          yPos += 16;
        });
      }

      // ══════════════════════════════════════════
      //  TERMS & CONDITIONS
      // ══════════════════════════════════════════
      if (invoice.terms) {
        yPos += 25;
        if (yPos > 720) { doc.addPage(); yPos = 50; }

        doc.fontSize(10).fillColor(textColor).font("Helvetica-Bold").text("Terms & Conditions", marginX, yPos);
        yPos += 14;
        doc.fontSize(9).fillColor(mutedColor).font("Helvetica").text(invoice.terms, marginX, yPos, { width: contentW });
      }

      // ══════════════════════════════════════════
      //  FOOTER
      // ══════════════════════════════════════════
      const footerY = 780;
      doc.moveTo(marginX, footerY).lineTo(pageW - marginX, footerY).strokeColor(borderColor).lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(lightMuted).font("Helvetica")
        .text("Thank you for choosing ClutchGear Auto Services!", marginX, footerY + 8, { align: "center", width: contentW })
        .text("For queries, contact our support team.", marginX, footerY + 20, { align: "center", width: contentW });

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
