/**
 * Inventory Routes
 * Admin inventory management endpoints
 */
const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventory.controller");
const {
  authenticate,
  isAdmin,
  validate,
  validateObjectId,
} = require("../middlewares");
const {
  createSparePartValidation,
  updateSparePartValidation,
  addStockValidation,
  deductStockValidation,
  adjustStockValidation,
  deductForInvoiceValidation,
  returnFromInvoiceValidation,
} = require("../validators/inventory.validator");

// All routes require admin authentication
router.use(authenticate, isAdmin);

// Dashboard
router.get("/dashboard", inventoryController.getDashboard);

// Categories
router.get("/categories", inventoryController.getCategories);

// Low stock alerts
router.get("/low-stock", inventoryController.getLowStockItems);

// Stock history / transactions
router.get("/transactions", inventoryController.getStockHistory);
router.get("/transactions/export", inventoryController.exportStockHistory);

// Invoice integration
router.post(
  "/deduct-for-invoice",
  deductForInvoiceValidation,
  validate,
  inventoryController.deductForInvoice
);
router.post(
  "/return-from-invoice",
  returnFromInvoiceValidation,
  validate,
  inventoryController.returnFromInvoice
);

// Barcode lookup (must be before :id route)
router.get("/barcode/:barcode", inventoryController.getByBarcode);

// CRUD operations
router.get("/", inventoryController.getSpareParts);
router.post(
  "/",
  createSparePartValidation,
  validate,
  inventoryController.createSparePart
);
router.get("/:id", validateObjectId("id"), inventoryController.getSparePart);
router.put(
  "/:id",
  validateObjectId("id"),
  updateSparePartValidation,
  validate,
  inventoryController.updateSparePart
);
router.delete(
  "/:id",
  validateObjectId("id"),
  inventoryController.deleteSparePart
);

// Stock management
router.post(
  "/:id/stock/add",
  validateObjectId("id"),
  addStockValidation,
  validate,
  inventoryController.addStock
);
router.post(
  "/:id/stock/deduct",
  validateObjectId("id"),
  deductStockValidation,
  validate,
  inventoryController.deductStock
);
router.post(
  "/:id/stock/adjust",
  validateObjectId("id"),
  adjustStockValidation,
  validate,
  inventoryController.adjustStock
);

module.exports = router;
