/**
 * Customer Validator
 * Validation rules for customer management
 */
const { body } = require("express-validator");

/**
 * Walk-in customer creation validation
 */
const createWalkInCustomerValidation = [
  body("mobile")
    .notEmpty()
    .withMessage("Mobile number is required")
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Please enter a valid 10-digit Indian mobile number"),
  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),
  body("email").optional().isEmail().withMessage("Please enter a valid email"),
  body("address.street")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Street cannot exceed 200 characters"),
  body("address.city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),
  body("address.pincode")
    .optional()
    .matches(/^\d{6}$/)
    .withMessage("Please enter a valid 6-digit pincode"),
  // Vehicle details
  body("vehicle")
    .optional()
    .isObject()
    .withMessage("Vehicle must be an object"),
  body("vehicle.vehicleNumber")
    .optional()
    .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/i)
    .withMessage("Please enter a valid Indian vehicle number"),
  body("vehicle.vehicleType")
    .optional()
    .isIn(["car", "bike", "scooter", "auto", "truck", "bus", "other"])
    .withMessage("Invalid vehicle type"),
  body("vehicle.brand")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Brand is required for vehicle"),
  body("vehicle.model")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Model is required for vehicle"),
  body("vehicle.year")
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage("Invalid vehicle year"),
  body("vehicle.fuelType")
    .optional()
    .isIn(["petrol", "diesel", "cng", "electric", "hybrid"])
    .withMessage("Invalid fuel type"),
  body("vehicle.color")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Color cannot exceed 50 characters"),
];

module.exports = {
  createWalkInCustomerValidation,
};
