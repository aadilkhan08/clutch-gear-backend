/**
 * Payment Controller
 * Handles payment operations
 */
const { Payment, JobCard, User } = require("../models");
const { pdfService, fcmService } = require("../services");
const {
  getRazorpayClient,
  getRazorpayKeyId,
} = require("../services/razorpay.service");
const crypto = require("crypto");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

const CHECKOUT_TOKEN_TTL_MINUTES = 30;

function createCheckoutToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildCheckoutUrl(req, token) {
  return `${req.protocol}://${req.get(
    "host"
  )}/api/v1/payments/razorpay/checkout/${token}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * @desc    Get user payments
 * @route   GET /api/v1/payments
 * @access  Private
 */
const getPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, jobCardId } = req.query;

  const query = { customer: req.userId };
  if (status) query.status = status;
  if (jobCardId) query.jobCard = jobCardId;

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate("jobCard", "jobNumber vehicleSnapshot")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Payments fetched successfully",
    payments,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get single payment
 * @route   GET /api/v1/payments/:id
 * @access  Private
 */
const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    customer: req.userId,
  }).populate("jobCard");

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  ApiResponse.success(res, "Payment fetched successfully", payment);
});

/**
 * @desc    Get payments for a job card (User)
 * @route   GET /api/v1/payments/jobcard/:jobCardId
 * @access  Private
 */
const getJobCardPayments = asyncHandler(async (req, res) => {
  const jobCard = await JobCard.findOne({
    _id: req.params.jobCardId,
    customer: req.userId,
  });

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  const paymentData = await Payment.getJobCardPayments(req.params.jobCardId);

  ApiResponse.success(res, "Job card payments fetched successfully", {
    ...paymentData,
    grandTotal: jobCard.billing.grandTotal,
    balanceDue: jobCard.billing.grandTotal - paymentData.totalPaid,
  });
});

/**
 * @desc    Create Razorpay order for an existing pending payment (User)
 * @route   POST /api/v1/payments/:id/razorpay/order
 * @access  Private
 */
const createRazorpayOrderForPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    customer: req.userId,
  }).populate("jobCard");

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.status !== "pending") {
    throw ApiError.badRequest("Only pending payments can be paid online");
  }

  const jobCardId = payment.jobCard?._id || payment.jobCard;
  const jobCard = await JobCard.findById(jobCardId);
  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  const existingPayments = await Payment.getJobCardPayments(jobCardId);
  const balanceDue = jobCard.billing.grandTotal - existingPayments.totalPaid;

  if (payment.amount > balanceDue) {
    throw ApiError.badRequest(
      `Payment amount exceeds balance due (₹${balanceDue})`
    );
  }

  let razorpay;
  try {
    razorpay = getRazorpayClient();
  } catch (e) {
    throw ApiError.serviceUnavailable(
      "Razorpay is not configured on the server"
    );
  }

  const amountPaise = Math.round(Number(payment.amount) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw ApiError.badRequest("Invalid payment amount");
  }

  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: payment.paymentNumber,
    notes: {
      paymentId: String(payment._id),
      jobCardId: String(jobCardId),
    },
  });

  const token = createCheckoutToken();
  const expiresAt = new Date(
    Date.now() + CHECKOUT_TOKEN_TTL_MINUTES * 60 * 1000
  );

  payment.transactionDetails = {
    ...(payment.transactionDetails || {}),
    gateway: "razorpay",
    orderId: order.id,
  };
  payment.checkout = { token, expiresAt };
  await payment.save();

  ApiResponse.success(res, "Razorpay order created", {
    orderId: order.id,
    amountPaise,
    currency: order.currency,
    checkoutUrl: buildCheckoutUrl(req, token),
    keyId: getRazorpayKeyId(),
    expiresAt,
  });
});

/**
 * @desc    Create Razorpay order for an existing pending payment (Admin)
 * @route   POST /api/v1/admin/payments/:id/razorpay/order
 * @access  Private/Admin
 */
const createRazorpayOrderForPaymentAdmin = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate("jobCard");

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.paymentType === "refund") {
    throw ApiError.badRequest("Refunds cannot be paid online");
  }

  if (payment.status !== "pending") {
    throw ApiError.badRequest("Only pending payments can be paid online");
  }

  const jobCardId = payment.jobCard?._id || payment.jobCard;
  const jobCard = await JobCard.findById(jobCardId);
  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  const existingPayments = await Payment.getJobCardPayments(jobCardId);
  const balanceDue = jobCard.billing.grandTotal - existingPayments.totalPaid;

  if (payment.amount > balanceDue) {
    throw ApiError.badRequest(
      `Payment amount exceeds balance due (₹${balanceDue})`
    );
  }

  let razorpay;
  try {
    razorpay = getRazorpayClient();
  } catch (e) {
    throw ApiError.serviceUnavailable(
      "Razorpay is not configured on the server"
    );
  }

  const amountPaise = Math.round(Number(payment.amount) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw ApiError.badRequest("Invalid payment amount");
  }

  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: payment.paymentNumber,
    notes: {
      paymentId: String(payment._id),
      jobCardId: String(jobCardId),
    },
  });

  const token = createCheckoutToken();
  const expiresAt = new Date(
    Date.now() + CHECKOUT_TOKEN_TTL_MINUTES * 60 * 1000
  );

  payment.transactionDetails = {
    ...(payment.transactionDetails || {}),
    gateway: "razorpay",
    orderId: order.id,
  };
  payment.checkout = { token, expiresAt };
  await payment.save();

  ApiResponse.success(res, "Razorpay order created", {
    orderId: order.id,
    amountPaise,
    currency: order.currency,
    checkoutUrl: buildCheckoutUrl(req, token),
    keyId: getRazorpayKeyId(),
    expiresAt,
  });
});

/**
 * @desc    Hosted Razorpay checkout (tokenized)
 * @route   GET /api/v1/payments/razorpay/checkout/:token
 * @access  Public (token)
 */
const renderRazorpayCheckout = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const payment = await Payment.findOne({ "checkout.token": token })
    .populate("jobCard", "jobNumber")
    .populate("customer", "name");

  if (!payment || payment.status !== "pending") {
    res.status(404).send("Invalid or expired checkout link");
    return;
  }

  if (payment.checkout?.expiresAt && payment.checkout.expiresAt < new Date()) {
    res.status(410).send("Checkout link expired");
    return;
  }

  const keyId = getRazorpayKeyId();
  if (!keyId) {
    res.status(503).send("Razorpay is not configured on the server");
    return;
  }

  const orderId = payment.transactionDetails?.orderId;
  if (!orderId) {
    res.status(400).send("Missing Razorpay order. Please retry from the app.");
    return;
  }

  const amountPaise = Math.round(Number(payment.amount) * 100);
  const customerName = escapeHtml(
    payment?.customer?.name || "ClutchGear Customer"
  );
  const description = escapeHtml(
    payment.jobCard?.jobNumber
      ? `Job #${payment.jobCard.jobNumber}`
      : `Payment #${payment.paymentNumber}`
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ClutchGear Payment</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; margin: 0; background: #0b1220; color: #e5e7eb; }
      .wrap { max-width: 520px; margin: 0 auto; padding: 24px; }
      .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 18px; }
      .title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
      .muted { color: rgba(229,231,235,0.75); font-size: 13px; }
      .amount { font-size: 32px; font-weight: 800; margin: 14px 0 10px; }
      .btn { width: 100%; padding: 12px 14px; font-weight: 800; border: 0; border-radius: 12px; background: #2563eb; color: white; cursor: pointer; }
      .btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .msg { margin-top: 12px; font-size: 13px; }
      a { color: #93c5fd; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <p class="title">Complete your payment</p>
        <p class="muted">${description}</p>
        <div class="amount">₹${Number(payment.amount || 0).toFixed(2)}</div>
        <button id="payBtn" class="btn">Pay with Razorpay</button>
        <div id="msg" class="msg muted"></div>
      </div>
    </div>

    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      const payBtn = document.getElementById('payBtn');
      const msg = document.getElementById('msg');
      function setMsg(text) { msg.textContent = text || ''; }

      function postToReactNative(payload) {
        try {
          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (_) {
          // no-op
        }
      }

      function startCheckout() {
        if (payBtn.disabled) return;

        payBtn.disabled = true;
        setMsg('Opening Razorpay...');

        const options = {
          key: ${JSON.stringify(keyId)},
          amount: ${JSON.stringify(amountPaise)},
          currency: "INR",
          name: "ClutchGear",
          description: ${JSON.stringify(description)},
          order_id: ${JSON.stringify(orderId)},
          handler: async function (response) {
            try {
              setMsg('Verifying payment...');
              const r = await fetch('/api/v1/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: ${JSON.stringify(token)},
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const data = await r.json();
              if (!r.ok || !data || data.success === false) {
                throw new Error((data && data.message) || 'Verification failed');
              }
              setMsg('Payment successful. You can return to the app.');
              postToReactNative({ type: 'razorpay', status: 'success' });
            } catch (e) {
              setMsg('Payment verification failed. Please contact support.');
              payBtn.disabled = false;
              postToReactNative({ type: 'razorpay', status: 'failed' });
            }
          },
          modal: {
            ondismiss: function () {
              setMsg('Payment cancelled.');
              payBtn.disabled = false;
              postToReactNative({ type: 'razorpay', status: 'cancelled' });
            }
          },
          prefill: {
            name: ${JSON.stringify(customerName)},
          },
          theme: { color: "#2563eb" }
        };

        const rzp = new Razorpay(options);
        rzp.open();

      }

      payBtn.addEventListener('click', startCheckout);

      // Auto-launch when embedded in a WebView (in-app payment)
      setTimeout(function () {
        startCheckout();
      }, 350);
    </script>
  </body>
</html>`);
});

/**
 * @desc    Verify Razorpay signature and mark payment completed (WebView/token flow)
 * @route   POST /api/v1/payments/razorpay/verify
 * @access  Public (token)
 */
const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { token, razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body || {};

  if (
    !token ||
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature
  ) {
    throw ApiError.badRequest("Missing Razorpay verification fields");
  }

  const payment = await Payment.findOne({ "checkout.token": token });
  if (!payment || payment.status !== "pending") {
    throw ApiError.notFound("Invalid or expired checkout token");
  }

  if (payment.checkout?.expiresAt && payment.checkout.expiresAt < new Date()) {
    throw ApiError.badRequest("Checkout token expired");
  }

  const expectedOrderId = payment.transactionDetails?.orderId;
  if (!expectedOrderId || expectedOrderId !== razorpay_order_id) {
    throw ApiError.badRequest("Order ID mismatch");
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw ApiError.serviceUnavailable(
      "Razorpay is not configured on the server"
    );
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw ApiError.badRequest("Invalid payment signature");
  }

  payment.status = "completed";
  payment.transactionId = razorpay_payment_id;
  payment.transactionDetails = {
    ...(payment.transactionDetails || {}),
    gateway: "razorpay",
    orderId: razorpay_order_id,
    signature: razorpay_signature,
  };
  payment.checkout = undefined;
  await payment.save();

  ApiResponse.success(res, "Payment verified", {
    paymentId: payment._id,
    status: payment.status,
  });
});

/**
 * @desc    Verify Razorpay signature for native SDK (paymentId flow)
 * @route   POST /api/v1/admin/payments/:id/razorpay/verify
 * @access  Private/Admin
 */
const verifyRazorpayPaymentNative = asyncHandler(async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw ApiError.badRequest("Missing Razorpay verification fields");
  }

  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.status !== "pending") {
    throw ApiError.badRequest("Payment is not pending");
  }

  const expectedOrderId = payment.transactionDetails?.orderId;
  if (!expectedOrderId || expectedOrderId !== razorpay_order_id) {
    throw ApiError.badRequest("Order ID mismatch");
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw ApiError.serviceUnavailable(
      "Razorpay is not configured on the server"
    );
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw ApiError.badRequest("Invalid payment signature");
  }

  payment.status = "completed";
  payment.transactionId = razorpay_payment_id;
  payment.transactionDetails = {
    ...(payment.transactionDetails || {}),
    gateway: "razorpay",
    orderId: razorpay_order_id,
    signature: razorpay_signature,
  };
  payment.checkout = undefined;
  await payment.save();

  ApiResponse.success(res, "Payment verified and completed", {
    paymentId: payment._id,
    status: payment.status,
  });
});

/**
 * @desc    Verify Razorpay signature for native SDK (User flow)
 * @route   POST /api/v1/payments/:id/razorpay/verify
 * @access  Private
 */
const verifyRazorpayPaymentNativeUser = asyncHandler(async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
    req.body || {};

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw ApiError.badRequest("Missing Razorpay verification fields");
  }

  // Ensure user owns this payment
  const payment = await Payment.findOne({
    _id: req.params.id,
    customer: req.userId,
  }).populate("jobCard");

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.status !== "pending") {
    throw ApiError.badRequest("Payment is not pending");
  }

  const expectedOrderId = payment.transactionDetails?.orderId;
  if (!expectedOrderId || expectedOrderId !== razorpay_order_id) {
    throw ApiError.badRequest("Order ID mismatch");
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw ApiError.serviceUnavailable(
      "Razorpay is not configured on the server"
    );
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw ApiError.badRequest("Invalid payment signature");
  }

  payment.status = "completed";
  payment.transactionId = razorpay_payment_id;
  payment.transactionDetails = {
    ...(payment.transactionDetails || {}),
    gateway: "razorpay",
    orderId: razorpay_order_id,
    signature: razorpay_signature,
  };
  payment.checkout = undefined;
  await payment.save();

  ApiResponse.success(res, "Payment verified and completed", {
    payment: {
      _id: payment._id,
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      status: payment.status,
      transactionId: payment.transactionId,
      paymentMethod: payment.paymentMethod,
      paymentType: payment.paymentType,
      jobCard: payment.jobCard
        ? {
            _id: payment.jobCard._id,
            jobNumber: payment.jobCard.jobNumber,
            vehicleSnapshot: payment.jobCard.vehicleSnapshot,
          }
        : null,
      createdAt: payment.createdAt,
    },
  });
});

// ============ Admin Controllers ============

/**
 * @desc    Get all payments (Admin)
 * @route   GET /api/v1/admin/payments
 * @access  Private/Admin
 */
const getAllPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { status, paymentMethod, dateFrom, dateTo, customerId } = req.query;

  const query = {};
  if (status) query.status = status;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (customerId) query.customer = customerId;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate("customer", "name mobile")
      .populate("jobCard", "jobNumber vehicleSnapshot")
      .populate("receivedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Payments fetched successfully",
    payments,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Create payment (Admin)
 * @route   POST /api/v1/admin/payments
 * @access  Private/Admin
 */
const createPayment = asyncHandler(async (req, res) => {
  const {
    jobCardId,
    amount,
    paymentType,
    paymentMethod,
    status: requestedStatus,
    transactionId,
    transactionDetails,
    notes,
  } = req.body;

  // Get job card
  const jobCard = await JobCard.findById(jobCardId);

  if (!jobCard) {
    throw ApiError.notFound("Job card not found");
  }

  // Check if amount is valid
  const existingPayments = await Payment.getJobCardPayments(jobCardId);
  const balanceDue = jobCard.billing.grandTotal - existingPayments.totalPaid;

  if (paymentType !== "refund" && amount > balanceDue) {
    throw ApiError.badRequest(`Amount exceeds balance due (₹${balanceDue})`);
  }

  const status =
    requestedStatus === "pending" && paymentType !== "refund"
      ? "pending"
      : "completed";

  // Create payment
  const payment = await Payment.create({
    jobCard: jobCardId,
    customer: jobCard.customer,
    amount,
    paymentType,
    paymentMethod,
    status,
    transactionId,
    transactionDetails,
    receivedBy: req.userId,
    notes,
  });

  await payment.populate([
    { path: "customer", select: "name mobile" },
    { path: "jobCard", select: "jobNumber vehicleSnapshot" },
  ]);

  // Send push notification for payment confirmation (completed only)
  if (payment.status === "completed") {
    try {
      const customer = await User.findById(jobCard.customer)
        .select("deviceInfo")
        .lean();
      if (customer) {
        await fcmService.notifyPaymentReceived(customer, payment);
      }
    } catch (error) {
      console.error("Push notification for payment failed:", error);
    }
  }

  ApiResponse.created(
    res,
    payment.status === "pending"
      ? "Payment request created successfully"
      : "Payment recorded successfully",
    payment
  );
});

/**
 * @desc    Update payment status (Admin)
 * @route   PUT /api/v1/admin/payments/:id
 * @access  Private/Admin
 */
const updatePayment = asyncHandler(async (req, res) => {
  const { status, transactionId, notes } = req.body;

  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (status) payment.status = status;
  if (transactionId) payment.transactionId = transactionId;
  if (notes) payment.notes = notes;

  await payment.save();

  ApiResponse.success(res, "Payment updated successfully", payment);
});

/**
 * @desc    Process refund (Admin)
 * @route   POST /api/v1/admin/payments/:id/refund
 * @access  Private/Admin
 */
const processRefund = asyncHandler(async (req, res) => {
  const { amount, reason } = req.body;

  const originalPayment = await Payment.findById(req.params.id);

  if (!originalPayment) {
    throw ApiError.notFound("Payment not found");
  }

  if (originalPayment.status !== "completed") {
    throw ApiError.badRequest("Can only refund completed payments");
  }

  if (amount > originalPayment.amount) {
    throw ApiError.badRequest("Refund amount cannot exceed original payment");
  }

  // Create refund record
  const refund = await Payment.create({
    jobCard: originalPayment.jobCard,
    customer: originalPayment.customer,
    amount,
    paymentType: "refund",
    paymentMethod: originalPayment.paymentMethod,
    status: "completed",
    receivedBy: req.userId,
    notes: `Refund for payment ${originalPayment.paymentNumber}`,
    refundDetails: {
      refundedAmount: amount,
      refundedAt: new Date(),
      reason,
      refundedBy: req.userId,
    },
  });

  // Update original payment
  originalPayment.status = "refunded";
  originalPayment.refundDetails = {
    refundedAmount: amount,
    refundedAt: new Date(),
    reason,
    refundedBy: req.userId,
  };
  await originalPayment.save();

  ApiResponse.success(res, "Refund processed successfully", refund);
});

/**
 * @desc    Get payment summary (Admin)
 * @route   GET /api/v1/admin/payments/summary
 * @access  Private/Admin
 */
const getPaymentSummary = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;

  const matchQuery = { status: "completed" };
  if (dateFrom || dateTo) {
    matchQuery.createdAt = {};
    if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
  }

  const summary = await Payment.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$paymentMethod",
        total: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "refund"] },
              { $multiply: ["$amount", -1] },
              "$amount",
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const totalCollection = summary.reduce((sum, s) => sum + s.total, 0);

  ApiResponse.success(res, "Payment summary fetched successfully", {
    byMethod: summary,
    totalCollection,
    totalTransactions: summary.reduce((sum, s) => sum + s.count, 0),
  });
});

/**
 * @desc    Get today's collection (Admin)
 * @route   GET /api/v1/admin/payments/today
 * @access  Private/Admin
 */
const getTodayCollection = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const payments = await Payment.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    status: "completed",
  })
    .populate("jobCard", "jobNumber")
    .sort({ createdAt: -1 })
    .lean();

  const totalCollection = payments.reduce((sum, p) => {
    return p.paymentType === "refund" ? sum - p.amount : sum + p.amount;
  }, 0);

  ApiResponse.success(res, "Today's collection fetched successfully", {
    payments,
    totalCollection,
    count: payments.length,
  });
});

/**
 * @desc    Download invoice PDF for a payment (Admin)
 * @route   GET /api/v1/admin/payments/:id/invoice
 * @access  Private/Admin
 */
const downloadInvoice = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("customer", "name mobile email")
    .populate("jobCard")
    .lean();

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  // Get job card details for the invoice
  const jobCard = await JobCard.findById(payment.jobCard._id || payment.jobCard)
    .populate("vehicle", "vehicleNumber brand model year")
    .populate("customer", "name mobile email address")
    .lean();

  if (!jobCard) {
    throw ApiError.notFound("Job card not found for this payment");
  }

  // Generate PDF
  const pdfBuffer = await pdfService.generateInvoicePDF(payment, jobCard);

  // Set response headers for PDF download
  const invoiceNumber =
    payment.invoiceNumber ||
    `INV-${payment._id.toString().slice(-8).toUpperCase()}`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoiceNumber}.pdf"`
  );
  res.setHeader("Content-Length", pdfBuffer.length);

  res.send(pdfBuffer);
});

/**
 * @desc    Download receipt PDF for a payment (User)
 * @route   GET /api/v1/payments/:id/receipt
 * @access  Private
 */
const downloadReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    customer: req.userId,
  })
    .populate("customer", "name mobile email")
    .populate("jobCard", "jobNumber vehicleSnapshot")
    .lean();

  if (!payment) {
    throw ApiError.notFound("Payment not found");
  }

  if (payment.status !== "completed") {
    throw ApiError.badRequest(
      "Receipt is only available for completed payments"
    );
  }

  // Generate receipt PDF
  const pdfBuffer = await pdfService.generateReceiptPDF(payment);

  // Set response headers for PDF download
  const receiptNumber = `RCP-${payment._id.toString().slice(-8).toUpperCase()}`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${receiptNumber}.pdf"`
  );
  res.setHeader("Content-Length", pdfBuffer.length);

  res.send(pdfBuffer);
});

module.exports = {
  // User
  getPayments,
  getPayment,
  getJobCardPayments,
  downloadReceipt,
  createRazorpayOrderForPayment,
  renderRazorpayCheckout,
  verifyRazorpayPayment,
  verifyRazorpayPaymentNativeUser,
  // Admin
  getAllPayments,
  createRazorpayOrderForPaymentAdmin,
  verifyRazorpayPaymentNative,
  createPayment,
  updatePayment,
  processRefund,
  getPaymentSummary,
  getTodayCollection,
  downloadInvoice,
};
