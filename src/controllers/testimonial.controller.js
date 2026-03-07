/**
 * Testimonial Controller
 * Admin CRUD + public listing for customer home testimonials
 */
const { Testimonial } = require("../models");
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
 * List all testimonials (admin)
 */
const listTestimonials = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const { isActive } = req.query;

    const query = {};
    if (isActive !== undefined) query.isActive = isActive === "true";

    const [items, total] = await Promise.all([
        Testimonial.find(query)
            .sort({ priority: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean({ virtuals: true }),
        Testimonial.countDocuments(query),
    ]);

    ApiResponse.paginated(
        res,
        "Testimonials fetched",
        items,
        createPaginationMeta(total, page, limit)
    );
});

/**
 * Get single testimonial (admin)
 */
const getTestimonial = asyncHandler(async (req, res) => {
    const testimonial = await Testimonial.findById(req.params.id).lean({
        virtuals: true,
    });
    if (!testimonial) throw ApiError.notFound("Testimonial not found");
    ApiResponse.success(res, "Testimonial fetched", testimonial);
});

/**
 * Create testimonial (admin)
 */
const createTestimonial = asyncHandler(async (req, res) => {
    const {
        customerName,
        customerImage,
        video,
        caption,
        rating,
        serviceName,
        priority,
        isActive,
    } = req.body;

    const testimonial = await Testimonial.create({
        customerName,
        customerImage,
        video,
        caption,
        rating: rating || 5,
        serviceName,
        priority: priority || 10,
        isActive: isActive !== false,
        createdBy: req.userId,
    });

    ApiResponse.created(res, "Testimonial created", testimonial);
});

/**
 * Update testimonial (admin)
 */
const updateTestimonial = asyncHandler(async (req, res) => {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) throw ApiError.notFound("Testimonial not found");

    // If video is being replaced, clean up old one from ImageKit
    if (req.body.video && req.body.video.fileId && testimonial.video?.fileId
        && req.body.video.fileId !== testimonial.video.fileId) {
        imagekitService.deleteImage(testimonial.video.fileId).catch((err) =>
            console.error("ImageKit cleanup (old testimonial video):", err.message)
        );
    }
    // If customerImage is being replaced, clean up old one
    if (req.body.customerImage && req.body.customerImage.fileId && testimonial.customerImage?.fileId
        && req.body.customerImage.fileId !== testimonial.customerImage.fileId) {
        imagekitService.deleteImage(testimonial.customerImage.fileId).catch((err) =>
            console.error("ImageKit cleanup (old testimonial image):", err.message)
        );
    }

    const allowedFields = [
        "customerName",
        "customerImage",
        "video",
        "caption",
        "rating",
        "serviceName",
        "priority",
        "isActive",
    ];
    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            testimonial[field] = req.body[field];
        }
    });

    await testimonial.save();
    ApiResponse.success(res, "Testimonial updated", testimonial);
});

/**
 * Delete testimonial (admin)
 */
const deleteTestimonial = asyncHandler(async (req, res) => {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) throw ApiError.notFound("Testimonial not found");

    // Clean up ImageKit files
    const cleanups = [];
    if (testimonial.video?.fileId) {
        cleanups.push(imagekitService.deleteImage(testimonial.video.fileId));
    }
    if (testimonial.customerImage?.fileId) {
        cleanups.push(imagekitService.deleteImage(testimonial.customerImage.fileId));
    }
    if (cleanups.length) {
        Promise.all(cleanups).catch((err) =>
            console.error("ImageKit cleanup (testimonial):", err.message)
        );
    }

    await testimonial.deleteOne();
    ApiResponse.success(res, "Testimonial deleted");
});

/**
 * Toggle testimonial active status (admin)
 */
const toggleTestimonial = asyncHandler(async (req, res) => {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) throw ApiError.notFound("Testimonial not found");
    testimonial.isActive = !testimonial.isActive;
    await testimonial.save();
    ApiResponse.success(
        res,
        `Testimonial ${testimonial.isActive ? "activated" : "deactivated"}`,
        testimonial
    );
});

// ─── Public Endpoints ───

/**
 * Get active testimonials for customer home
 * Returns all active testimonials sorted by priority
 */
const getActiveTestimonials = asyncHandler(async (req, res) => {
    const testimonials = await Testimonial.find({ isActive: true })
        .sort({ priority: 1, createdAt: -1 })
        .select("customerName customerImage video caption rating serviceName")
        .lean();

    ApiResponse.success(res, "Active testimonials", testimonials);
});

module.exports = {
    listTestimonials,
    getTestimonial,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    toggleTestimonial,
    getActiveTestimonials,
};
