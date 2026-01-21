/**
 * Inventory Validators
 * Validation rules for inventory endpoints
 */
const { body } = require("express-validator");

const CATEGORIES = [
  "spare-part",
  "consumable",
  "accessory",
  "lubricant",
  "filter",
  "battery",
  "tyre",
  "brake",
  "electrical",
  "tool",
  "other",
];

const UNITS = ["piece", "liter", "kg", "set", "pair", "meter", "ml", "gram"];

const createSparePartValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Part name is required")
    .isLength({ max: 200 })
    .withMessage("Name cannot exceed 200 characters"),
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isIn(CATEGORIES)
    .withMessage("Invalid category"),
  body("costPrice")
    .notEmpty()
    .withMessage("Cost price is required")
    .isFloat({ min: 0 })
    .withMessage("Cost price must be 0 or greater"),
  body("sellingPrice")
    .notEmpty()
    .withMessage("Selling price is required")
    .isFloat({ min: 0 })
    .withMessage("Selling price must be 0 or greater"),
  body("barcode")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Barcode must be 1-50 characters"),
  body("brand")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Brand cannot exceed 100 characters"),
  body("partNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Part number cannot exceed 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("unit").optional().isIn(UNITS).withMessage("Invalid unit"),
  body("currentStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Current stock must be 0 or greater"),
  body("minStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Min stock must be 0 or greater"),
  body("maxStock")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Max stock must be 0 or greater"),
  body("mrp")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("MRP must be 0 or greater"),
  body("taxRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Tax rate must be between 0 and 100"),
  body("warranty.hasWarranty")
    .optional()
    .isBoolean()
    .withMessage("Warranty flag must be boolean"),
  body("warranty.period.value")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Warranty period must be 0 or greater"),
  body("warranty.period.unit")
    .optional()
    .isIn(["days", "months", "years"])
    .withMessage("Warranty unit must be days, months, or years"),
];

const updateSparePartValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Name cannot exceed 200 characters"),
  body("category").optional().isIn(CATEGORIES).withMessage("Invalid category"),
  body("costPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost price must be 0 or greater"),
  body("sellingPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Selling price must be 0 or greater"),
  body("barcode")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Barcode cannot exceed 50 characters"),
  body("brand")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Brand cannot exceed 100 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

const addStockValidation = [
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("unitPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Unit price must be 0 or greater"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
  body("supplier.name")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Supplier name cannot exceed 200 characters"),
  body("supplier.invoiceNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Invoice number cannot exceed 100 characters"),
];

const deductStockValidation = [
  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("reason")
    .optional()
    .isIn(["adjustment", "damage", "other"])
    .withMessage("Invalid reason"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const adjustStockValidation = [
  body("newQuantity")
    .notEmpty()
    .withMessage("New quantity is required")
    .isInt({ min: 0 })
    .withMessage("New quantity must be 0 or greater"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const deductForInvoiceValidation = [
  body("parts").isArray({ min: 1 }).withMessage("Parts array is required"),
  body("parts.*.partId")
    .notEmpty()
    .withMessage("Part ID is required")
    .isMongoId()
    .withMessage("Invalid part ID"),
  body("parts.*.quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("jobCardId").optional().isMongoId().withMessage("Invalid job card ID"),
  body("invoiceNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Invoice number cannot exceed 100 characters"),
];

const returnFromInvoiceValidation = [
  body("parts").isArray({ min: 1 }).withMessage("Parts array is required"),
  body("parts.*.partId")
    .notEmpty()
    .withMessage("Part ID is required")
    .isMongoId()
    .withMessage("Invalid part ID"),
  body("parts.*.quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("jobCardId").optional().isMongoId().withMessage("Invalid job card ID"),
  body("invoiceNumber").optional().trim(),
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
];

module.exports = {
  createSparePartValidation,
  updateSparePartValidation,
  addStockValidation,
  deductStockValidation,
  adjustStockValidation,
  deductForInvoiceValidation,
  returnFromInvoiceValidation,
};
