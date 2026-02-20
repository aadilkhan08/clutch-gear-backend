/**
 * Promotion Controller
 * Admin CRUD + public listing for customer banners
 */
const { Promotion } = require("../models");
const {
    ApiResponse,
    ApiError,
    asyncHandler,
    parsePagination,
    createPaginationMeta,
} = require("../utils");

// ─── Admin Endpoints ───

/**
 * List all promotions (admin)
 */
const listPromotions = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { isActive, tag } = req.query;

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (tag) query.tags = tag;

    const [items, total] = await Promise.all([
        Promotion.find(query)
            .sort({ priority: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean({ virtuals: true }),
        Promotion.countDocuments(query),
    ]);

    ApiResponse.paginated(
        res,
        "Promotions fetched",
        items,
        createPaginationMeta(total, page, limit)
    );
});

/**
 * Get single promotion (admin)
 */
const getPromotion = asyncHandler(async (req, res) => {
    const promotion = await Promotion.findById(req.params.id).lean({
        virtuals: true,
    });
    if (!promotion) throw ApiError.notFound("Promotion not found");
    ApiResponse.success(res, "Promotion fetched", promotion);
});

/**
 * Create promotion (admin)
 */
const createPromotion = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        bannerImage,
        ctaType,
        ctaValue,
        ctaLabel,
        startDate,
        endDate,
        priority,
        isActive,
        tags,
    } = req.body;

    const promotion = await Promotion.create({
        title,
        description,
        bannerImage,
        ctaType,
        ctaValue,
        ctaLabel,
        startDate,
        endDate,
        priority: priority || 10,
        isActive: isActive !== false,
        tags: tags || [],
        createdBy: req.userId,
    });

    ApiResponse.created(res, "Promotion created", promotion);
});

/**
 * Update promotion (admin)
 */
const updatePromotion = asyncHandler(async (req, res) => {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) throw ApiError.notFound("Promotion not found");

    const allowedFields = [
        "title",
        "description",
        "bannerImage",
        "ctaType",
        "ctaValue",
        "ctaLabel",
        "startDate",
        "endDate",
        "priority",
        "isActive",
        "tags",
    ];

    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            promotion[field] = req.body[field];
        }
    });

    await promotion.save();
    ApiResponse.success(res, "Promotion updated", promotion);
});

/**
 * Delete promotion (admin)
 */
const deletePromotion = asyncHandler(async (req, res) => {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) throw ApiError.notFound("Promotion not found");
    await promotion.deleteOne();
    ApiResponse.success(res, "Promotion deleted");
});

/**
 * Toggle promotion active status (admin)
 */
const togglePromotion = asyncHandler(async (req, res) => {
    const promotion = await Promotion.findById(req.params.id);
    if (!promotion) throw ApiError.notFound("Promotion not found");
    promotion.isActive = !promotion.isActive;
    await promotion.save();
    ApiResponse.success(
        res,
        `Promotion ${promotion.isActive ? "activated" : "deactivated"}`,
        promotion
    );
});

/**
 * Promotion analytics (admin)
 */
const getPromotionAnalytics = asyncHandler(async (req, res) => {
    const now = new Date();
    const [total, active, live, topPerforming] = await Promise.all([
        Promotion.countDocuments(),
        Promotion.countDocuments({ isActive: true }),
        Promotion.countDocuments({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
        }),
        Promotion.find({ clicks: { $gt: 0 } })
            .sort({ clicks: -1 })
            .limit(5)
            .select("title clicks impressions bannerImage")
            .lean({ virtuals: true }),
    ]);

    ApiResponse.success(res, "Promotion analytics", {
        totalPromotions: total,
        activePromotions: active,
        liveNow: live,
        topPerforming,
    });
});

// ─── Public Endpoints ───

/**
 * Get active promotions for customer carousel
 * Returns only currently live promotions sorted by priority
 */
const getActivePromotions = asyncHandler(async (req, res) => {
    const now = new Date();
    const promotions = await Promotion.find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
    })
        .sort({ priority: 1, createdAt: -1 })
        .select("title description bannerImage ctaType ctaValue ctaLabel priority")
        .lean();

    // Increment impressions in background (fire-and-forget)
    if (promotions.length > 0) {
        const ids = promotions.map((p) => p._id);
        Promotion.updateMany(
            { _id: { $in: ids } },
            { $inc: { impressions: 1 } }
        ).exec();
    }

    ApiResponse.success(res, "Active promotions", promotions);
});

/**
 * Record a click on a promotion (public, authenticated)
 */
const recordClick = asyncHandler(async (req, res) => {
    await Promotion.findByIdAndUpdate(req.params.id, {
        $inc: { clicks: 1 },
    });
    ApiResponse.success(res, "Click recorded");
});

module.exports = {
    listPromotions,
    getPromotion,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotion,
    getPromotionAnalytics,
    getActivePromotions,
    recordClick,
};
