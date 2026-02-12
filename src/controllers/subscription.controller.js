/**
 * Subscription Controller
 * Customer subscription management operations
 */
const mongoose = require("mongoose");
const {
  Subscription,
  Package,
  Vehicle,
  Payment,
  JobCard,
} = require("../models");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");
const razorpayService = require("../services/razorpay.service");
const fcmService = require("../services/fcm.service");

/**
 * Calculate end date based on duration
 */
const calculateEndDate = (startDate, duration) => {
  const date = new Date(startDate);
  switch (duration.unit) {
    case "days":
      date.setDate(date.getDate() + duration.value);
      break;
    case "months":
      date.setMonth(date.getMonth() + duration.value);
      break;
    case "years":
      date.setFullYear(date.getFullYear() + duration.value);
      break;
  }
  return date;
};

/**
 * @desc    Get customer's subscriptions
 * @route   GET /api/v1/subscriptions
 * @access  Private
 */
const getMySubscriptions = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const { status, vehicleId } = req.query;

  const query = { customer: req.user._id };
  if (status) query.status = status;
  if (vehicleId) query.vehicle = vehicleId;

  const [subscriptions, total] = await Promise.all([
    Subscription.find(query)
      .populate("package", "name code type image")
      .populate("vehicle", "vehicleNumber brand model")
      .sort(sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Subscription.countDocuments(query),
  ]);

  return ApiResponse.paginated(
    res,
    "Subscriptions retrieved successfully",
    subscriptions,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get subscription by ID
 * @route   GET /api/v1/subscriptions/:id
 * @access  Private
 */
const getSubscriptionById = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    _id: req.params.id,
    customer: req.user._id,
  })
    .populate(
      "package",
      "name code type description image services features inclusions exclusions"
    )
    .populate("vehicle", "vehicleNumber brand model year color image")
    .populate("usage.service", "name category");

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  return ApiResponse.success(
    res,
    "Subscription retrieved successfully",
    subscription
  );
});

/**
 * @desc    Purchase a package (create subscription)
 * @route   POST /api/v1/subscriptions
 * @access  Private
 */
const purchasePackage = asyncHandler(async (req, res) => {
  const { packageId, vehicleId, startDate } = req.body;

  // Validate package
  const pkg = await Package.findById(packageId).populate(
    "services.service",
    "name"
  );

  if (!pkg) {
    throw new ApiError(404, "Package not found");
  }

  if (!pkg.isActive) {
    throw new ApiError(400, "This package is not available");
  }

  // Check availability
  if (!pkg.isAvailable) {
    throw new ApiError(
      400,
      "This package is not currently available for purchase"
    );
  }

  // Validate vehicle
  const vehicle = await Vehicle.findOne({
    _id: vehicleId,
    owner: req.user._id,
    isActive: true,
  });

  if (!vehicle) {
    throw new ApiError(404, "Vehicle not found");
  }

  // Check vehicle type compatibility
  if (
    !pkg.vehicleTypes.includes("all") &&
    !pkg.vehicleTypes.includes(vehicle.type)
  ) {
    throw new ApiError(
      400,
      `This package is not available for ${vehicle.type} vehicles`
    );
  }

  // Check for existing active subscription for same package and vehicle
  const existingSub = await Subscription.findOne({
    customer: req.user._id,
    package: packageId,
    vehicle: vehicleId,
    status: "active",
  });

  if (existingSub) {
    throw new ApiError(
      400,
      "You already have an active subscription for this package and vehicle"
    );
  }

  // Calculate dates
  const subStartDate = startDate ? new Date(startDate) : new Date();
  const subEndDate = calculateEndDate(subStartDate, pkg.duration);

  // Create package snapshot
  const packageSnapshot = {
    name: pkg.name,
    code: pkg.code,
    type: pkg.type,
    price: pkg.price,
    duration: pkg.duration,
    services: pkg.services.map((s) => ({
      serviceId: s.service._id,
      serviceName: s.service.name,
      maxUsage: s.maxUsage,
    })),
  };

  // Initialize usage tracking
  const usage = pkg.services.map((s) => ({
    service: s.service._id,
    usedCount: 0,
    maxAllowed: s.maxUsage,
    history: [],
  }));

  // Calculate total amount with tax
  const taxAmount = (pkg.price * pkg.taxRate) / 100;
  const totalAmount = pkg.price + taxAmount;

  // Create subscription
  const subscription = await Subscription.create({
    customer: req.user._id,
    package: packageId,
    vehicle: vehicleId,
    packageSnapshot,
    startDate: subStartDate,
    endDate: subEndDate,
    status: "pending", // Will be activated after payment
    usage,
    payment: {
      amount: totalAmount,
    },
  });

  // Note: subscription count will be incremented upon activation (payment verification)

  await subscription.populate([
    { path: "package", select: "name code type image" },
    { path: "vehicle", select: "vehicleNumber brand model" },
  ]);

  return ApiResponse.created(
    res,
    "Subscription created. Please complete payment to activate.",
    {
      subscription,
      paymentRequired: true,
      amount: totalAmount,
    }
  );
});

/**
 * @desc    Create Razorpay order for subscription payment
 * @route   POST /api/v1/subscriptions/:id/payment/order
 * @access  Private
 */
const createPaymentOrder = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    _id: req.params.id,
    customer: req.user._id,
    status: "pending",
  }).populate("package", "name code");

  if (!subscription) {
    throw new ApiError(404, "Pending subscription not found");
  }

  const amount = subscription.payment.amount;
  const receipt = `SUB_${subscription.subscriptionNumber}`;

  const order = await razorpayService.createOrder(amount, receipt, {
    subscriptionId: subscription._id.toString(),
    customerId: req.user._id.toString(),
  });

  // Store order ID for verification
  subscription.payment.orderId = order.id;
  await subscription.save();

  return ApiResponse.success(res, "Payment order created", {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: razorpayService.getKeyId(),
    subscriptionNumber: subscription.subscriptionNumber,
    packageName: subscription.package.name,
  });
});

/**
 * @desc    Verify payment and activate subscription
 * @route   POST /api/v1/subscriptions/:id/payment/verify
 * @access  Private
 */
const verifyPaymentAndActivate = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const subscription = await Subscription.findOne({
    _id: req.params.id,
    customer: req.user._id,
    status: "pending",
  }).populate("package", "name");

  if (!subscription) {
    throw new ApiError(404, "Pending subscription not found");
  }

  // Verify stored order matches
  if (subscription.payment.orderId !== razorpay_order_id) {
    throw new ApiError(400, "Order ID mismatch");
  }

  // Verify signature
  const isValid = razorpayService.verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    throw new ApiError(400, "Payment verification failed");
  }

  // Create payment record
  const payment = await Payment.create({
    customer: req.user._id,
    amount: subscription.payment.amount,
    paymentType: "subscription",
    paymentMethod: "online",
    status: "completed",
    transactionId: razorpay_payment_id,
    metadata: {
      razorpay_order_id,
      razorpay_signature,
      subscriptionId: subscription._id,
    },
  });

  // Activate subscription
  subscription.status = "active";
  subscription.payment.paymentId = payment._id;
  subscription.payment.paidAt = new Date();
  subscription.payment.method = "online";
  subscription.activatedBy = req.user._id;
  await subscription.save();

  // Increment package subscription count now that payment is confirmed
  try {
    await Package.findByIdAndUpdate(subscription.package, {
      $inc: { currentSubscriptions: 1 },
    });
  } catch (countErr) {
    console.error("Failed to increment subscription count:", countErr);
  }

  // Send notification
  try {
    await fcmService.sendToUser(req.user._id, {
      title: "Subscription Activated! 🎉",
      body: `Your ${
        subscription.package.name
      } subscription is now active until ${subscription.endDate.toLocaleDateString()}`,
      data: {
        type: "subscription_activated",
        subscriptionId: subscription._id.toString(),
      },
    });
  } catch (notifError) {
    console.error("Failed to send subscription notification:", notifError);
  }

  await subscription.populate([
    { path: "package", select: "name code type image" },
    { path: "vehicle", select: "vehicleNumber brand model" },
  ]);

  return ApiResponse.success(
    res,
    "Subscription activated successfully",
    subscription
  );
});

/**
 * @desc    Check if service is covered by customer subscription
 * @route   GET /api/v1/subscriptions/check-service/:serviceId
 * @access  Private
 */
const checkServiceCoverage = asyncHandler(async (req, res) => {
  const { vehicleId } = req.query;
  const { serviceId } = req.params;

  const query = {
    customer: req.user._id,
    status: "active",
    endDate: { $gte: new Date() },
    "usage.service": serviceId,
  };

  if (vehicleId) {
    query.vehicle = vehicleId;
  }

  const subscription = await Subscription.findOne(query)
    .populate("package", "name code")
    .populate("vehicle", "vehicleNumber brand model");

  if (!subscription) {
    return ApiResponse.success(res, "Service coverage checked", {
      covered: false,
      message: "No active subscription covers this service",
    });
  }

  const serviceUsage = subscription.usage.find(
    (u) => u.service.toString() === serviceId
  );

  if (!serviceUsage) {
    return ApiResponse.success(res, "Service coverage checked", {
      covered: false,
      message: "Service not included in subscription",
    });
  }

  const remaining =
    serviceUsage.maxAllowed === -1
      ? "unlimited"
      : serviceUsage.maxAllowed - serviceUsage.usedCount;

  const covered =
    serviceUsage.maxAllowed === -1 ||
    serviceUsage.usedCount < serviceUsage.maxAllowed;

  return ApiResponse.success(res, "Service coverage checked", {
    covered,
    subscription: {
      _id: subscription._id,
      subscriptionNumber: subscription.subscriptionNumber,
      packageName: subscription.package.name,
      vehicle: subscription.vehicle,
      endDate: subscription.endDate,
    },
    usage: {
      used: serviceUsage.usedCount,
      max: serviceUsage.maxAllowed,
      remaining,
    },
  });
});

/**
 * @desc    Use subscription service (deduct from remaining)
 * @route   POST /api/v1/subscriptions/:id/use-service
 * @access  Private/Admin
 */
const useSubscriptionService = asyncHandler(async (req, res) => {
  const { serviceId, jobCardId, notes } = req.body;

  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  if (subscription.status !== "active") {
    throw new ApiError(400, "Subscription is not active");
  }

  if (new Date() > subscription.endDate) {
    subscription.status = "expired";
    await subscription.save();
    throw new ApiError(400, "Subscription has expired");
  }

  // Check service availability
  const canUse = subscription.canUseService(serviceId);
  if (!canUse.allowed) {
    throw new ApiError(400, canUse.reason);
  }

  // Record usage
  await subscription.recordUsage(serviceId, jobCardId, notes);

  // Check if all services exhausted
  const allExhausted = subscription.usage.every(
    (u) => u.maxAllowed !== -1 && u.usedCount >= u.maxAllowed
  );

  if (allExhausted) {
    subscription.status = "completed";
    await subscription.save();

    // Send notification
    try {
      await fcmService.sendToUser(subscription.customer, {
        title: "Subscription Completed",
        body: "You have used all services in your subscription package.",
        data: {
          type: "subscription_completed",
          subscriptionId: subscription._id.toString(),
        },
      });
    } catch (error) {
      console.error("Failed to send completion notification:", error);
    }
  }

  return ApiResponse.success(res, "Service usage recorded", {
    subscription,
    serviceUsed: true,
    remaining: canUse.remaining - 1,
    allExhausted,
  });
});

// ==================== ADMIN OPERATIONS ====================

/**
 * @desc    Get all subscriptions (Admin)
 * @route   GET /api/v1/admin/subscriptions
 * @access  Private/Admin
 */
const getAllSubscriptions = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = parsePagination(req.query);
  const { status, packageId, customerId, search } = req.query;

  const query = {};
  if (status) query.status = status;
  if (packageId) query.package = packageId;
  if (customerId) query.customer = customerId;
  if (search) {
    query.$or = [{ subscriptionNumber: { $regex: search, $options: "i" } }];
  }

  const [subscriptions, total] = await Promise.all([
    Subscription.find(query)
      .populate("customer", "name phone email")
      .populate("package", "name code type")
      .populate("vehicle", "vehicleNumber brand model")
      .sort(sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Subscription.countDocuments(query),
  ]);

  return ApiResponse.paginated(
    res,
    "Subscriptions retrieved successfully",
    subscriptions,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get subscription details (Admin)
 * @route   GET /api/v1/admin/subscriptions/:id
 * @access  Private/Admin
 */
const getSubscriptionDetails = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id)
    .populate("customer", "name phone email profileImage")
    .populate("package", "name code type description image services")
    .populate("vehicle", "vehicleNumber brand model year color image")
    .populate("usage.service", "name category")
    .populate("usage.history.jobCard", "jobNumber status")
    .populate("payment.paymentId");

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  return ApiResponse.success(
    res,
    "Subscription details retrieved",
    subscription
  );
});

/**
 * @desc    Activate subscription manually (Admin - for offline payments)
 * @route   POST /api/v1/admin/subscriptions/:id/activate
 * @access  Private/Admin
 */
const activateSubscription = asyncHandler(async (req, res) => {
  const { paymentMethod, transactionId, notes } = req.body;

  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  if (subscription.status === "active") {
    throw new ApiError(400, "Subscription is already active");
  }

  if (subscription.status === "cancelled") {
    throw new ApiError(400, "Cannot activate a cancelled subscription");
  }

  // For cash payments, require transaction/receipt ID
  if (paymentMethod === "cash" && !transactionId) {
    throw new ApiError(
      400,
      "Receipt/Transaction ID required for cash payments"
    );
  }

  // Create payment record
  const payment = await Payment.create({
    customer: subscription.customer,
    amount: subscription.payment.amount,
    paymentType: "subscription",
    paymentMethod: paymentMethod || "cash",
    status: "completed",
    transactionId: transactionId || `CASH_${Date.now()}`,
    notes,
    collectedBy: req.user._id,
  });

  // Activate subscription
  subscription.status = "active";
  subscription.payment.paymentId = payment._id;
  subscription.payment.paidAt = new Date();
  subscription.payment.method = paymentMethod || "cash";
  subscription.activatedBy = req.user._id;
  subscription.notes = notes;
  await subscription.save();

  // Increment package subscription count now that payment is confirmed
  try {
    await Package.findByIdAndUpdate(subscription.package, {
      $inc: { currentSubscriptions: 1 },
    });
  } catch (countErr) {
    console.error("Failed to increment subscription count:", countErr);
  }

  // Send notification
  try {
    await fcmService.sendToUser(subscription.customer, {
      title: "Subscription Activated! 🎉",
      body: `Your subscription has been activated. Valid until ${subscription.endDate.toLocaleDateString()}`,
      data: {
        type: "subscription_activated",
        subscriptionId: subscription._id.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  await subscription.populate([
    { path: "customer", select: "name phone" },
    { path: "package", select: "name code" },
    { path: "vehicle", select: "vehicleNumber brand model" },
  ]);

  return ApiResponse.success(
    res,
    "Subscription activated successfully",
    subscription
  );
});

/**
 * @desc    Cancel subscription (Admin)
 * @route   POST /api/v1/admin/subscriptions/:id/cancel
 * @access  Private/Admin
 */
const cancelSubscription = asyncHandler(async (req, res) => {
  const { reason, refundAmount } = req.body;

  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  if (subscription.status === "cancelled") {
    throw new ApiError(400, "Subscription is already cancelled");
  }

  subscription.status = "cancelled";
  subscription.cancellation = {
    cancelledAt: new Date(),
    reason: reason || "Cancelled by admin",
    cancelledBy: req.user._id,
    refundAmount: refundAmount || 0,
    refundStatus: refundAmount > 0 ? "pending" : "none",
  };

  await subscription.save();

  // Decrement package subscription count
  await Package.findByIdAndUpdate(subscription.package, {
    $inc: { currentSubscriptions: -1 },
  });

  // Send notification
  try {
    await fcmService.sendToUser(subscription.customer, {
      title: "Subscription Cancelled",
      body: `Your subscription has been cancelled. ${
        refundAmount > 0 ? `Refund of ₹${refundAmount} will be processed.` : ""
      }`,
      data: {
        type: "subscription_cancelled",
        subscriptionId: subscription._id.toString(),
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  return ApiResponse.success(res, "Subscription cancelled", subscription);
});

/**
 * @desc    Extend subscription (Admin)
 * @route   POST /api/v1/admin/subscriptions/:id/extend
 * @access  Private/Admin
 */
const extendSubscription = asyncHandler(async (req, res) => {
  const { days, reason } = req.body;

  if (!days || days <= 0) {
    throw new ApiError(400, "Please specify valid number of days to extend");
  }

  const subscription = await Subscription.findById(req.params.id);

  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  if (subscription.status === "cancelled") {
    throw new ApiError(400, "Cannot extend a cancelled subscription");
  }

  const previousEndDate = new Date(subscription.endDate);
  const newEndDate = new Date(subscription.endDate);
  newEndDate.setDate(newEndDate.getDate() + days);

  subscription.endDate = newEndDate;

  // Reactivate if expired
  if (subscription.status === "expired") {
    subscription.status = "active";
  }

  // Log extension
  subscription.renewalHistory.push({
    renewedAt: new Date(),
    previousEndDate,
    newEndDate,
    reason,
    extendedBy: req.user._id,
  });

  await subscription.save();

  return ApiResponse.success(
    res,
    `Subscription extended by ${days} days until ${newEndDate.toLocaleDateString()}`,
    subscription
  );
});

/**
 * @desc    Get subscription usage report (Admin)
 * @route   GET /api/v1/admin/subscriptions/reports/usage
 * @access  Private/Admin
 */
const getUsageReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, packageId } = req.query;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage["usage.history.usedAt"] = {};
    if (startDate)
      matchStage["usage.history.usedAt"].$gte = new Date(startDate);
    if (endDate) matchStage["usage.history.usedAt"].$lte = new Date(endDate);
  }
  if (packageId) matchStage.package = new mongoose.Types.ObjectId(packageId);

  const report = await Subscription.aggregate([
    { $match: matchStage },
    { $unwind: "$usage" },
    { $unwind: "$usage.history" },
    {
      $group: {
        _id: "$usage.service",
        totalUsage: { $sum: 1 },
        uniqueCustomers: { $addToSet: "$customer" },
      },
    },
    {
      $lookup: {
        from: "services",
        localField: "_id",
        foreignField: "_id",
        as: "serviceInfo",
      },
    },
    { $unwind: "$serviceInfo" },
    {
      $project: {
        serviceName: "$serviceInfo.name",
        serviceCategory: "$serviceInfo.category",
        totalUsage: 1,
        uniqueCustomers: { $size: "$uniqueCustomers" },
      },
    },
    { $sort: { totalUsage: -1 } },
  ]);

  return ApiResponse.success(res, "Usage report generated", report);
});

/**
 * @desc    Expire subscriptions (Cron job endpoint)
 * @route   POST /api/v1/admin/subscriptions/expire-check
 * @access  Private/Admin or System
 */
const expireSubscriptions = asyncHandler(async (req, res) => {
  const now = new Date();

  const expiredSubs = await Subscription.find({
    status: "active",
    endDate: { $lt: now },
  }).populate("customer", "name");

  let expiredCount = 0;

  for (const sub of expiredSubs) {
    sub.status = "expired";
    await sub.save();
    expiredCount++;

    // Send notification
    try {
      await fcmService.sendToUser(sub.customer._id, {
        title: "Subscription Expired",
        body: "Your service subscription has expired. Renew to continue enjoying benefits!",
        data: {
          type: "subscription_expired",
          subscriptionId: sub._id.toString(),
        },
      });
    } catch (error) {
      console.error(`Failed to notify ${sub.customer.name}:`, error);
    }
  }

  return ApiResponse.success(
    res,
    `${expiredCount} subscription(s) marked as expired`,
    { expiredCount }
  );
});

module.exports = {
  // Customer operations
  getMySubscriptions,
  getSubscriptionById,
  purchasePackage,
  createPaymentOrder,
  verifyPaymentAndActivate,
  checkServiceCoverage,
  useSubscriptionService,
  // Admin operations
  getAllSubscriptions,
  getSubscriptionDetails,
  activateSubscription,
  cancelSubscription,
  extendSubscription,
  getUsageReport,
  expireSubscriptions,
};
