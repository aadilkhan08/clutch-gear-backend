/**
 * Vehicle Catalog Model
 * Master catalog of vehicle brands and models for autocomplete / suggestions.
 * Each document represents one brand for one vehicle type, with an embedded
 * array of models.
 */
const mongoose = require("mongoose");

const vehicleModelSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        popular: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false }
);

const vehicleCatalogSchema = new mongoose.Schema(
    {
        vehicleType: {
            type: String,
            enum: ["car", "bike", "scooter", "auto", "truck", "bus"],
            required: [true, "Vehicle type is required"],
            index: true,
        },
        brand: {
            type: String,
            required: [true, "Brand name is required"],
            trim: true,
        },
        popular: {
            type: Boolean,
            default: false,
        },
        models: [vehicleModelSchema],
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique: one brand per vehicle type
vehicleCatalogSchema.index({ vehicleType: 1, brand: 1 }, { unique: true });
// Text search on brand name
vehicleCatalogSchema.index({ brand: "text" });

module.exports = mongoose.model("VehicleCatalog", vehicleCatalogSchema);
