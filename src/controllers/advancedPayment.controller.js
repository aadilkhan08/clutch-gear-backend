/**
 * Advanced Payment & Refund Controller
 */
const { Payment, RefundRequest, JobCard, User } = require("../models");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");
const { getRazorpayClient } = require("../services/razorpay.service");

const computeStatus = (payment) => {
  const paid = Number(payment.paidAmount || 0);
  const total = Number(payment.totalAmount || 0);
  const balance = Math.max(total - paid, 0);
  payment.balanceAmount = balance;
  if (payment.paymentStatus === "REFUNDED") return;
  if (balance <= 0) payment.paymentStatus = "PAID";
  else payment.paymentStatus = "PARTIAL";
};

const getEffectiveDate = (payment) => payment.updatedAt || payment.createdAt;

const adminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  const start = new Date(today.setHours(0, 0, 0, 0));
  const end = new Date(today.setHours(23, 59, 59, 999));

  const [todayPayments, partialCount, refundPending, paidCount, refundedCount] =
    await Promise.all([
      Payment.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$paidAmount" } } },
      ]),
      Payment.countDocuments({ paymentStatus: "PARTIAL" }),
      RefundRequest.countDocuments({ status: "PENDING" }),
      Payment.countDocuments({ paymentStatus: "PAID" }),
      Payment.countDocuments({ paymentStatus: "REFUNDED" }),
    ]);

  ApiResponse.success(res, "Advanced payment dashboard", {
    totalPaymentsToday: todayPayments?.[0]?.total || 0,
    partialPaymentsPending: partialCount,
    refundRequestsPending: refundPending,
    paidCount,
    refundedCount,
  });
});

const listAdminPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { paymentStatus, customerId, invoiceId } = req.query;
  const query = {};
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (customerId) query.customer = customerId;
  if (invoiceId) query.invoiceId = invoiceId;

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate("customer", "name mobile")
      .populate("invoiceId", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Payments fetched",
    payments,
    createPaginationMeta(total, page, limit)
  );
});

const createInvoicePayment = asyncHandler(async (req, res) => {
  const { invoiceId, customerId, totalAmount, paymentMethod } = req.body;
  const jobCard = await JobCard.findById(invoiceId);
  if (!jobCard) throw ApiError.notFound("Invoice (job card) not found");

  const customer = await User.findById(customerId);
  if (!customer) throw ApiError.notFound("Customer not found");

  const payment = await Payment.create({
    jobCard: invoiceId,
    invoiceId,
    customer: customerId,
    amount: totalAmount,
    totalAmount,
    paidAmount: 0,
    balanceAmount: totalAmount,
    paymentMethod,
    paymentStatus: "PARTIAL",
    paymentType: "partial",
    status: "pending",
  });

  ApiResponse.created(res, "Invoice payment created", payment);
});

const addTransaction = asyncHandler(async (req, res) => {
  const { amount, method, transactionId } = req.body;
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found");

  payment.transactions = payment.transactions || [];
  payment.transactions.push({
    transactionId,
    amount,
    method,
    paidAt: new Date(),
  });

  payment.paidAmount = Number(payment.paidAmount || 0) + Number(amount || 0);
  computeStatus(payment);
  payment.status = payment.balanceAmount <= 0 ? "completed" : "pending";

  await payment.save();

  ApiResponse.success(res, "Transaction added", payment);
});

const markPaid = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found");

  const balance = Number(payment.balanceAmount || 0);
  if (balance <= 0) throw ApiError.badRequest("Payment already settled");

  payment.transactions = payment.transactions || [];
  payment.transactions.push({
    transactionId: req.body?.transactionId,
    amount: balance,
    method: req.body?.method || "CASH",
    paidAt: new Date(),
  });

  payment.paidAmount = Number(payment.paidAmount || 0) + balance;
  computeStatus(payment);
  payment.status = "completed";
  await payment.save();

  ApiResponse.success(res, "Payment marked as paid", payment);
});

const requestRefund = asyncHandler(async (req, res) => {
  const { paymentId, requestedAmount, reason } = req.body;
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound("Payment not found");

  if (requestedAmount > Number(payment.paidAmount || 0)) {
    throw ApiError.badRequest("Refund amount cannot exceed paid amount");
  }

  const refund = await RefundRequest.create({
    paymentId,
    invoiceId: payment.invoiceId || payment.jobCard,
    customerId: payment.customer,
    requestedAmount,
    reason,
    status: "PENDING",
    logs: [
      { action: "REQUESTED", by: req.userId || req.user?._id, remarks: reason },
    ],
  });

  payment.paymentStatus = "REFUND_PENDING";
  await payment.save();

  ApiResponse.created(res, "Refund request created", refund);
});

const listRefundsAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;

  const [refunds, total] = await Promise.all([
    RefundRequest.find(query)
      .populate("paymentId")
      .populate("customerId", "name mobile")
      .populate("invoiceId", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RefundRequest.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Refund requests fetched",
    refunds,
    createPaginationMeta(total, page, limit)
  );
});

const approveRefund = asyncHandler(async (req, res) => {
  const refund = await RefundRequest.findById(req.params.id);
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (refund.status !== "PENDING")
    throw ApiError.badRequest("Refund already processed");

  refund.status = "APPROVED";
  refund.adminRemarks = req.body?.adminRemarks || refund.adminRemarks;
  refund.logs.push({
    action: "APPROVED",
    by: req.userId || req.user?._id,
    remarks: refund.adminRemarks,
  });
  await refund.save();

  ApiResponse.success(res, "Refund approved", refund);
});

const rejectRefund = asyncHandler(async (req, res) => {
  const refund = await RefundRequest.findById(req.params.id);
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (refund.status !== "PENDING")
    throw ApiError.badRequest("Refund already processed");

  refund.status = "REJECTED";
  refund.adminRemarks = req.body?.adminRemarks || refund.adminRemarks;
  refund.logs.push({
    action: "REJECTED",
    by: req.userId || req.user?._id,
    remarks: refund.adminRemarks,
  });
  await refund.save();

  ApiResponse.success(res, "Refund rejected", refund);
});

const processRefund = asyncHandler(async (req, res) => {
  const refund = await RefundRequest.findById(req.params.id).populate(
    "paymentId"
  );
  if (!refund) throw ApiError.notFound("Refund request not found");
  if (!["APPROVED", "PENDING"].includes(refund.status)) {
    throw ApiError.badRequest("Refund cannot be processed");
  }

  const payment = await Payment.findById(refund.paymentId);
  if (!payment) throw ApiError.notFound("Payment not found");

  // If gateway is razorpay, attempt refund (best effort)
  if (payment.paymentMethod === "razorpay") {
    try {
      const razorpay = getRazorpayClient();
      if (payment.transactionId) {
        await razorpay.payments.refund(payment.transactionId, {
          amount: Math.round(refund.requestedAmount * 100),
        });
      }
    } catch (error) {
      console.error("Razorpay refund error:", error.message);
    }
  }

  payment.paidAmount = Math.max(
    Number(payment.paidAmount || 0) - Number(refund.requestedAmount || 0),
    0
  );
  computeStatus(payment);
  if (payment.paidAmount === 0) payment.paymentStatus = "REFUNDED";
  await payment.save();

  refund.status = "PROCESSED";
  refund.processedAt = new Date();
  refund.logs.push({
    action: "PROCESSED",
    by: req.userId || req.user?._id,
    remarks: req.body?.adminRemarks,
  });
  await refund.save();

  ApiResponse.success(res, "Refund processed", refund);
});

const listMyPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [payments, total] = await Promise.all([
    Payment.find({ customer: req.userId })
      .populate("invoiceId", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments({ customer: req.userId }),
  ]);

  ApiResponse.paginated(
    res,
    "My payments fetched",
    payments,
    createPaginationMeta(total, page, limit)
  );
});

const listMyRefunds = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [refunds, total] = await Promise.all([
    RefundRequest.find({ customerId: req.userId })
      .populate("invoiceId", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RefundRequest.countDocuments({ customerId: req.userId }),
  ]);

  ApiResponse.paginated(
    res,
    "My refunds fetched",
    refunds,
    createPaginationMeta(total, page, limit)
  );
});

module.exports = {
  adminDashboard,
  listAdminPayments,
  createInvoicePayment,
  addTransaction,
  markPaid,
  requestRefund,
  listRefundsAdmin,
  approveRefund,
  rejectRefund,
  processRefund,
  listMyPayments,
  listMyRefunds,
};
