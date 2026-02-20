/**
 * Vehicle Catalog Controller
 * Public endpoints for brand / model suggestions.
 */
const { VehicleCatalog } = require("../models");
const { ApiResponse, asyncHandler } = require("../utils");

/**
 * GET /vehicle-catalog/brands/:vehicleType
 * Returns brands for the given vehicle type, sorted popular-first.
 */
const getBrands = asyncHandler(async (req, res) => {
    const { vehicleType } = req.params;
    const { search } = req.query;

    const query = { vehicleType, isActive: true };
    if (search) {
        query.brand = { $regex: search, $options: "i" };
    }

    const brands = await VehicleCatalog.find(query)
        .select("brand popular")
        .sort({ popular: -1, brand: 1 })
        .lean();

    ApiResponse.success(res, "Brands fetched", brands);
});

/**
 * GET /vehicle-catalog/models/:vehicleType/:brand
 * Returns models for a specific brand & vehicle type, sorted popular-first.
 */
const getModels = asyncHandler(async (req, res) => {
    const { vehicleType, brand } = req.params;
    const { search } = req.query;

    const catalog = await VehicleCatalog.findOne({
        vehicleType,
        brand: { $regex: `^${brand}$`, $options: "i" },
        isActive: true,
    }).lean();

    if (!catalog) {
        return ApiResponse.success(res, "No models found", []);
    }

    let models = catalog.models || [];

    if (search) {
        const q = search.toLowerCase();
        models = models.filter((m) => m.name.toLowerCase().includes(q));
    }

    // Sort popular first, then alphabetical
    models.sort((a, b) => {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return a.name.localeCompare(b.name);
    });

    ApiResponse.success(res, "Models fetched", models);
});

/**
 * GET /vehicle-catalog/all
 * Returns the full catalog grouped by vehicle type (for client-side caching).
 */
const getFullCatalog = asyncHandler(async (req, res) => {
    const catalog = await VehicleCatalog.find({ isActive: true })
        .select("vehicleType brand popular models")
        .sort({ vehicleType: 1, popular: -1, brand: 1 })
        .lean();

    // Group by vehicleType for easier client consumption
    const grouped = {};
    for (const entry of catalog) {
        if (!grouped[entry.vehicleType]) {
            grouped[entry.vehicleType] = [];
        }
        grouped[entry.vehicleType].push({
            _id: entry._id,
            brand: entry.brand,
            popular: entry.popular,
            models: entry.models,
        });
    }

    ApiResponse.success(res, "Vehicle catalog fetched", grouped);
});

module.exports = {
    getBrands,
    getModels,
    getFullCatalog,
};
