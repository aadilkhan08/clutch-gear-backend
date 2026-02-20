/**
 * Partner Controller
 * Admin CRUD + public listing for partnership banners
 */
const { Partner } = require("../models");
const {
    ApiResponse,
    ApiError,
    asyncHandler,
    parsePagination,
    createPaginationMeta,
} = require("../utils");

// ─── Admin Endpoints ───

const listPartners = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { isActive } = req.query;
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [items, total] = await Promise.all([
        Partner.find(query)
            .sort({ priority: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Partner.countDocuments(query),
    ]);

    ApiResponse.paginated(
        res,
        "Partners fetched",
        items,
        createPaginationMeta(total, page, limit)
    );
});

const getPartner = asyncHandler(async (req, res) => {
    const partner = await Partner.findById(req.params.id).lean();
    if (!partner) throw ApiError.notFound("Partner not found");
    ApiResponse.success(res, "Partner fetched", partner);
});

const createPartner = asyncHandler(async (req, res) => {
    const {
        name,
        subtitle,
        description,
        logo,
        logoText,
        logoColor,
        bgColor,
        priority,
        isActive,
    } = req.body;

    const partner = await Partner.create({
        name,
        subtitle,
        description,
        logo: logo || undefined,
        logoText: logoText || undefined,
        logoColor: logoColor || "#DC2626",
        bgColor: bgColor || "#FEF2F2",
        priority: priority || 10,
        isActive: isActive !== false,
        createdBy: req.userId,
    });

    ApiResponse.created(res, "Partner created", partner);
});

const updatePartner = asyncHandler(async (req, res) => {
    const partner = await Partner.findById(req.params.id);
    if (!partner) throw ApiError.notFound("Partner not found");

    const allowedFields = [
        "name",
        "subtitle",
        "description",
        "logo",
        "logoText",
        "logoColor",
        "bgColor",
        "priority",
        "isActive",
    ];

    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) partner[field] = req.body[field];
    });

    await partner.save();
    ApiResponse.success(res, "Partner updated", partner);
});

const deletePartner = asyncHandler(async (req, res) => {
    const partner = await Partner.findById(req.params.id);
    if (!partner) throw ApiError.notFound("Partner not found");
    await partner.deleteOne();
    ApiResponse.success(res, "Partner deleted");
});

const togglePartner = asyncHandler(async (req, res) => {
    const partner = await Partner.findById(req.params.id);
    if (!partner) throw ApiError.notFound("Partner not found");
    partner.isActive = !partner.isActive;
    await partner.save();
    ApiResponse.success(
        res,
        `Partner ${partner.isActive ? "activated" : "deactivated"}`,
        partner
    );
});

// ─── Public Endpoints ───

const getActivePartners = asyncHandler(async (req, res) => {
    const partners = await Partner.find({ isActive: true })
        .sort({ priority: 1, createdAt: -1 })
        .select("name subtitle description logo logoText logoColor bgColor priority")
        .lean();

    ApiResponse.success(res, "Active partners", partners);
});

module.exports = {
    listPartners,
    getPartner,
    createPartner,
    updatePartner,
    deletePartner,
    togglePartner,
    getActivePartners,
};
