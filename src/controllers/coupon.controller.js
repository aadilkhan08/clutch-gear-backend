/**
 * Coupon Controller
 */
const { Coupon, JobCard } = require("../models");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

const normalizeCoupon = (payload) => {
  const discountType = payload.discountType || payload.type;
  const usageLimitInput = payload.usageLimit;
  const usageLimitTotal =
    typeof usageLimitInput === "number"
      ? usageLimitInput
      : usageLimitInput?.total ?? -1;
  const noticePerUser = payload.perCustomerLimit ?? usageLimitInput?.perUser;

  return {
    code: payload.code?.toUpperCase?.() || payload.code,
    description: payload.description,
    type:
      discountType === "PERCENT"
        ? "percentage"
        : discountType === "FLAT"
        ? "flat"
        : payload.type,
    value: payload.discountValue ?? payload.value,
    maxDiscount: payload.maxDiscountAmount ?? payload.maxDiscount,
    minOrderAmount: payload.minInvoiceAmount ?? payload.minOrderAmount ?? 0,
    validFrom: payload.validFrom,
    validUntil: payload.validTill ?? payload.validUntil,
    usageLimit: {
      total: usageLimitTotal ?? -1,
      perUser: noticePerUser ?? 1,
    },
    isActive: payload.isActive !== false,
  };
};

const listAdminCoupons = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { isActive, code } = req.query;
  const query = {};

  if (isActive !== undefined) query.isActive = isActive === "true";
  if (code) query.code = String(code).toUpperCase();

  const [items, total] = await Promise.all([
    Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Coupons fetched",
    items,
    createPaginationMeta(total, page, limit)
  );
});

const createCoupon = asyncHandler(async (req, res) => {
  const data = normalizeCoupon(req.body);
  if (!data.code || !data.type || data.value === undefined) {
    throw ApiError.badRequest("Missing required coupon fields");
  }

  const existing = await Coupon.findOne({ code: data.code });
  if (existing) throw ApiError.conflict("Coupon code already exists");

  const coupon = await Coupon.create({
    ...data,
    createdBy: req.userId,
  });

  ApiResponse.created(res, "Coupon created", coupon);
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found");

  const data = normalizeCoupon({ ...coupon.toObject(), ...req.body });

  coupon.description = data.description;
  coupon.type = data.type;
  coupon.value = data.value;
  coupon.maxDiscount = data.maxDiscount;
  coupon.minOrderAmount = data.minOrderAmount;
  coupon.validFrom = data.validFrom;
  coupon.validUntil = data.validUntil;
  coupon.usageLimit = data.usageLimit;
  if (typeof req.body.isActive === "boolean")
    coupon.isActive = req.body.isActive;

  await coupon.save();
  ApiResponse.success(res, "Coupon updated", coupon);
});

const toggleCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found");
  coupon.isActive = !coupon.isActive;
  await coupon.save();
  ApiResponse.success(res, "Coupon status updated", coupon);
});

const getCouponAnalytics = asyncHandler(async (req, res) => {
  const [total, active, redeemed] = await Promise.all([
    Coupon.countDocuments(),
    Coupon.countDocuments({ isActive: true }),
    Coupon.aggregate([{ $group: { _id: null, used: { $sum: "$usedCount" } } }]),
  ]);

  ApiResponse.success(res, "Coupon analytics", {
    totalCoupons: total,
    activeCoupons: active,
    totalRedemptions: redeemed?.[0]?.used || 0,
  });
});

const listPublicCoupons = asyncHandler(async (req, res) => {
  const now = new Date();
  const coupons = await Coupon.find({
    isPublic: true,
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  })
    .sort({ createdAt: -1 })
    .lean();

  ApiResponse.success(res, "Public coupons", coupons);
});

const validateCoupon = asyncHandler(async (req, res) => {
  const { code, jobCardId } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) throw ApiError.notFound("Coupon not found");

  const jobCard = await JobCard.findOne({
    _id: jobCardId,
    customer: req.userId,
  });

  if (!jobCard) throw ApiError.notFound("Job card not found");

  jobCard.calculateBilling();
  const orderAmount = Number(jobCard.billing.subtotal || 0);

  const validation = await coupon.canBeUsedBy(req.userId, orderAmount);
  if (!validation.valid) {
    return ApiResponse.success(res, validation.reason, {
      valid: false,
      reason: validation.reason,
    });
  }

  const discountAmount = coupon.calculateDiscount(orderAmount);
  ApiResponse.success(res, "Coupon is valid", {
    valid: true,
    discountAmount,
    discountType: coupon.type,
  });
});

const applyCoupon = asyncHandler(async (req, res) => {
  const { code, jobCardId } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) throw ApiError.notFound("Coupon not found");

  const jobCard = await JobCard.findOne({
    _id: jobCardId,
    customer: req.userId,
  });

  if (!jobCard) throw ApiError.notFound("Job card not found");

  if (
    jobCard.billing?.coupon?.code &&
    jobCard.billing.coupon.code !== coupon.code
  ) {
    throw ApiError.badRequest("A coupon is already applied to this invoice");
  }

  jobCard.calculateBilling();
  const orderAmount = Number(jobCard.billing.subtotal || 0);

  const validation = await coupon.canBeUsedBy(req.userId, orderAmount);
  if (!validation.valid) {
    throw ApiError.badRequest(validation.reason || "Coupon cannot be used");
  }

  const discountAmount = coupon.calculateDiscount(orderAmount);

  jobCard.billing.discount = discountAmount;
  jobCard.billing.discountReason = `COUPON:${coupon.code}`;
  jobCard.billing.coupon = {
    code: coupon.code,
    couponId: coupon._id,
    discountType: coupon.type,
    discountValue: coupon.value,
    discountAmount,
  };

  jobCard.calculateBilling();
  await jobCard.save();

  await coupon.recordUsage(req.userId, jobCard._id, discountAmount);

  ApiResponse.success(res, "Coupon applied", {
    jobCardId: jobCard._id,
    discountAmount,
    grandTotal: jobCard.billing.grandTotal,
  });
});

module.exports = {
  listAdminCoupons,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  getCouponAnalytics,
  listPublicCoupons,
  validateCoupon,
  applyCoupon,
};
