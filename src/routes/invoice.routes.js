/**
 * Invoice Routes
 * Customer-facing invoice endpoints
 */
const express = require("express");
const router = express.Router();
const {
  getInvoices,
  getInvoice,
  getInvoiceByJobCard,
  downloadInvoicePDF,
  createPaymentOrder,
  verifyPayment,
} = require("../controllers/invoice.controller");
const { authenticate, authorize } = require("../middlewares");

// All routes require authentication
router.use(authenticate);

// @route   GET /api/v1/invoices
// @desc    Get customer invoices
router.get("/", authorize("customer", "admin", "superadmin"), getInvoices);

// @route   GET /api/v1/invoices/job-card/:jobCardId
// @desc    Get invoice by job card ID
router.get(
  "/job-card/:jobCardId",
  authorize("customer", "admin", "superadmin"),
  getInvoiceByJobCard
);

// @route   GET /api/v1/invoices/:id
// @desc    Get invoice detail
router.get("/:id", authorize("customer", "admin", "superadmin"), getInvoice);

// @route   GET /api/v1/invoices/:id/pdf
// @desc    Download invoice PDF
router.get(
  "/:id/pdf",
  authorize("customer", "admin", "superadmin"),
  downloadInvoicePDF
);

// @route   POST /api/v1/invoices/:id/payment/order
// @desc    Create Razorpay order for invoice payment
router.post(
  "/:id/payment/order",
  authorize("customer"),
  createPaymentOrder
);

// @route   POST /api/v1/invoices/:id/payment/verify
// @desc    Verify Razorpay payment and update invoice
router.post(
  "/:id/payment/verify",
  authorize("customer"),
  verifyPayment
);

module.exports = router;
