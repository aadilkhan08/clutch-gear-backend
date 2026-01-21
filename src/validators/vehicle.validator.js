/**
 * Vehicle Validators
 * Validation rules for vehicle endpoints
 */
const { body } = require("express-validator");

const addVehicleValidation = [
  body("vehicleNumber")
    .notEmpty()
    .withMessage("Vehicle number is required")
    .matches(/^[A-Za-z]{2}[0-9]{1,2}[A-Za-z]{0,3}[0-9]{1,4}$/)
    .withMessage("Please enter a valid Indian vehicle number"),
  body("vehicleType")
    .notEmpty()
    .withMessage("Vehicle type is required")
    .isIn(["car", "bike", "scooter", "auto", "truck", "bus", "other"])
    .withMessage("Invalid vehicle type"),
  body("brand")
    .notEmpty()
    .withMessage("Brand is required")
    .trim()
    .isLength({ max: 100 })
    .withMessage("Brand cannot exceed 100 characters"),
  body("model")
    .notEmpty()
    .withMessage("Model is required")
    .trim()
    .isLength({ max: 100 })
    .withMessage("Model cannot exceed 100 characters"),
  body("year")
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage("Please enter a valid year"),
  body("fuelType")
    .optional()
    .isIn(["petrol", "diesel", "cng", "electric", "hybrid"])
    .withMessage("Invalid fuel type"),
  body("color")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Color cannot exceed 50 characters"),
];

const updateVehicleValidation = [
  body("vehicleType")
    .optional()
    .isIn(["car", "bike", "scooter", "auto", "truck", "bus", "other"])
    .withMessage("Invalid vehicle type"),
  body("brand")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Brand cannot exceed 100 characters"),
  body("model")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Model cannot exceed 100 characters"),
  body("year")
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage("Please enter a valid year"),
  body("fuelType")
    .optional()
    .isIn(["petrol", "diesel", "cng", "electric", "hybrid"])
    .withMessage("Invalid fuel type"),
  body("insuranceExpiry")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format"),
  body("pucExpiry").optional().isISO8601().withMessage("Invalid date format"),
];

module.exports = {
  addVehicleValidation,
  updateVehicleValidation,
};
