/**
 * Banner Controller
 * Admin CRUD + public endpoint for customer home banner
 */
const { Banner } = require("../models");
const { imagekitService } = require("../services");
const {
    ApiResponse,
    ApiError,
    asyncHandler,
    parsePagination,
    createPaginationMeta,
} = require("../utils");

// ─── Admin Endpoints ───

/**
 * List all banners (admin)
 */
const listBanners = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { isActive } = req.query;

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [items, total] = await Promise.all([
        Banner.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean({ virtuals: true }),
        Banner.countDocuments(query),
    ]);

    ApiResponse.paginated(
        res,
        "Banners fetched",
        items,
        createPaginationMeta(total, page, limit)
    );
});

/**
 * Get single banner (admin)
 */
const getBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id).lean({ virtuals: true });
    if (!banner) throw ApiError.notFound("Banner not found");
    ApiResponse.success(res, "Banner fetched", banner);
});

/**
 * Create banner (admin)
 */
const createBanner = asyncHandler(async (req, res) => {
    const { title, subtitle, image, linkType, linkValue, isActive } = req.body;

    const banner = await Banner.create({
        title,
        subtitle,
        image,
        linkType,
        linkValue,
        isActive: isActive !== false,
        createdBy: req.userId,
    });

    ApiResponse.created(res, "Banner created", banner);
});

/**
 * Update banner (admin)
 */
const updateBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw ApiError.notFound("Banner not found");

    // If image is being replaced, clean up old one from ImageKit
    if (req.body.image && req.body.image.fileId && banner.image?.fileId
        && req.body.image.fileId !== banner.image.fileId) {
        imagekitService.deleteImage(banner.image.fileId).catch((err) =>
            console.error("ImageKit cleanup (old banner image):", err.message)
        );
    }

    const allowedFields = ["title", "subtitle", "image", "linkType", "linkValue", "isActive"];
    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            banner[field] = req.body[field];
        }
    });

    await banner.save();
    ApiResponse.success(res, "Banner updated", banner);
});

/**
 * Delete banner (admin)
 */
const deleteBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw ApiError.notFound("Banner not found");

    // Clean up ImageKit file
    if (banner.image?.fileId) {
        imagekitService.deleteImage(banner.image.fileId).catch((err) =>
            console.error("ImageKit cleanup (banner image):", err.message)
        );
    }

    await banner.deleteOne();
    ApiResponse.success(res, "Banner deleted");
});

/**
 * Toggle banner active status (admin)
 */
const toggleBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);
    if (!banner) throw ApiError.notFound("Banner not found");
    banner.isActive = !banner.isActive;
    await banner.save();
    ApiResponse.success(
        res,
        `Banner ${banner.isActive ? "activated" : "deactivated"}`,
        banner
    );
});

// ─── Public Endpoints ───

/**
 * Get the active banner for customer home
 * Returns the latest active banner (only one is shown)
 */
const getActiveBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findOne({ isActive: true })
        .sort({ createdAt: -1 })
        .select("title subtitle image linkType linkValue")
        .lean();

    ApiResponse.success(res, "Active banner", banner);
});

module.exports = {
    listBanners,
    getBanner,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBanner,
    getActiveBanner,
};
