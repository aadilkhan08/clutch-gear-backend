/**
 * Inventory Controller
 * Spare parts and stock management for Admin
 */
const mongoose = require("mongoose");
const { Inventory, InventoryTransaction, User } = require("../models");
const { fcmService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

// ============ Dashboard & Stats ============

/**
 * @desc    Get inventory dashboard stats
 * @route   GET /api/v1/admin/inventory/dashboard
 * @access  Private/Admin
 */
const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalParts,
    lowStockCount,
    outOfStockCount,
    stockValue,
    categoryStats,
    recentTransactions,
  ] = await Promise.all([
    Inventory.countDocuments({ isActive: true }),
    Inventory.countDocuments({
      isActive: true,
      $expr: {
        $and: [
          { $lte: ["$currentStock", "$minStock"] },
          { $gt: ["$currentStock", 0] },
        ],
      },
    }),
    Inventory.countDocuments({ isActive: true, currentStock: 0 }),
    Inventory.getTotalStockValue(),
    Inventory.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalStock: { $sum: "$currentStock" },
          totalValue: { $sum: { $multiply: ["$currentStock", "$costPrice"] } },
        },
      },
      { $sort: { totalValue: -1 } },
    ]),
    InventoryTransaction.find()
      .populate("inventory", "name sku")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  ApiResponse.success(res, "Inventory dashboard fetched successfully", {
    stats: {
      totalParts,
      lowStockCount,
      outOfStockCount,
      totalStockValue: stockValue.totalCostValue,
      totalSellingValue: stockValue.totalSellingValue,
      totalStockUnits: stockValue.totalStock,
    },
    categoryStats,
    recentTransactions,
  });
});

// ============ Spare Parts CRUD ============

/**
 * @desc    Get all spare parts with filters
 * @route   GET /api/v1/admin/inventory
 * @access  Private/Admin
 */
const getSpareParts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const {
    search,
    category,
    brand,
    stockStatus,
    sortBy = "name",
    sortOrder = "asc",
  } = req.query;

  const query = { isActive: true };

  // Text search
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { partNumber: { $regex: search, $options: "i" } },
    ];
  }

  if (category) query.category = category;
  if (brand) query.brand = { $regex: brand, $options: "i" };

  // Stock status filter
  if (stockStatus === "low") {
    query.$expr = {
      $and: [
        { $lte: ["$currentStock", "$minStock"] },
        { $gt: ["$currentStock", 0] },
      ],
    };
  } else if (stockStatus === "out") {
    query.currentStock = 0;
  } else if (stockStatus === "healthy") {
    query.$expr = { $gt: ["$currentStock", "$minStock"] };
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  const [spareParts, total] = await Promise.all([
    Inventory.find(query).sort(sortOptions).skip(skip).limit(limit).lean(),
    Inventory.countDocuments(query),
  ]);

  // Add computed fields
  const enrichedParts = spareParts.map((part) => ({
    ...part,
    isLowStock: part.currentStock <= part.minStock && part.currentStock > 0,
    isOutOfStock: part.currentStock === 0,
    profitMargin:
      part.costPrice > 0
        ? ((part.sellingPrice - part.costPrice) / part.costPrice) * 100
        : 0,
  }));

  ApiResponse.paginated(
    res,
    "Spare parts fetched successfully",
    enrichedParts,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Get single spare part
 * @route   GET /api/v1/admin/inventory/:id
 * @access  Private/Admin
 */
const getSparePart = asyncHandler(async (req, res) => {
  const sparePart = await Inventory.findById(req.params.id);

  if (!sparePart) {
    throw ApiError.notFound("Spare part not found");
  }

  // Get recent transactions for this part
  const transactions = await InventoryTransaction.find({
    inventory: sparePart._id,
  })
    .populate("performedBy", "name")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  // Get usage stats
  const usageStats = await InventoryTransaction.aggregate([
    { $match: { inventory: sparePart._id } },
    {
      $group: {
        _id: "$type",
        totalQuantity: { $sum: { $abs: "$quantity" } },
        count: { $sum: 1 },
      },
    },
  ]);

  ApiResponse.success(res, "Spare part fetched successfully", {
    sparePart: sparePart.toJSON(),
    transactions,
    usageStats,
  });
});

/**
 * @desc    Lookup spare part by barcode
 * @route   GET /api/v1/admin/inventory/barcode/:barcode
 * @access  Private/Admin
 */
const getByBarcode = asyncHandler(async (req, res) => {
  const sparePart = await Inventory.findOne({
    barcode: req.params.barcode,
    isActive: true,
  }).lean();

  if (!sparePart) {
    throw ApiError.notFound("Spare part not found with this barcode");
  }

  ApiResponse.success(res, "Spare part found", sparePart);
});

/**
 * @desc    Create spare part
 * @route   POST /api/v1/admin/inventory
 * @access  Private/Admin
 */
const createSparePart = asyncHandler(async (req, res) => {
  const {
    name,
    barcode,
    category,
    brand,
    partNumber,
    description,
    unit,
    currentStock,
    minStock,
    maxStock,
    costPrice,
    sellingPrice,
    mrp,
    taxRate,
    location,
    vehicleCompatibility,
    supplier,
    warranty,
  } = req.body;

  // Check for duplicate barcode
  if (barcode) {
    const existing = await Inventory.findOne({ barcode });
    if (existing) {
      throw ApiError.badRequest("A part with this barcode already exists");
    }
  }

  const sparePart = await Inventory.create({
    name,
    barcode,
    category,
    brand,
    partNumber,
    description,
    unit,
    currentStock: currentStock || 0,
    minStock: minStock || 5,
    maxStock: maxStock || 100,
    costPrice,
    sellingPrice,
    mrp,
    taxRate,
    location,
    vehicleCompatibility,
    supplier,
    warranty,
    lastRestocked: currentStock > 0 ? new Date() : undefined,
  });

  // Create initial stock transaction if stock > 0
  if (currentStock > 0) {
    await InventoryTransaction.create({
      inventory: sparePart._id,
      type: "purchase",
      quantity: currentStock,
      previousStock: 0,
      newStock: currentStock,
      unitPrice: costPrice,
      totalAmount: currentStock * costPrice,
      performedBy: req.userId,
      notes: "Initial stock entry",
    });
  }

  ApiResponse.created(res, "Spare part created successfully", sparePart);
});

/**
 * @desc    Update spare part
 * @route   PUT /api/v1/admin/inventory/:id
 * @access  Private/Admin
 */
const updateSparePart = asyncHandler(async (req, res) => {
  const sparePart = await Inventory.findById(req.params.id);

  if (!sparePart) {
    throw ApiError.notFound("Spare part not found");
  }

  const {
    name,
    barcode,
    category,
    brand,
    partNumber,
    description,
    unit,
    minStock,
    maxStock,
    costPrice,
    sellingPrice,
    mrp,
    taxRate,
    location,
    vehicleCompatibility,
    supplier,
    warranty,
    isActive,
  } = req.body;

  // Check for duplicate barcode
  if (barcode && barcode !== sparePart.barcode) {
    const existing = await Inventory.findOne({ barcode });
    if (existing) {
      throw ApiError.badRequest("A part with this barcode already exists");
    }
  }

  // Update fields
  if (name !== undefined) sparePart.name = name;
  if (barcode !== undefined) sparePart.barcode = barcode;
  if (category !== undefined) sparePart.category = category;
  if (brand !== undefined) sparePart.brand = brand;
  if (partNumber !== undefined) sparePart.partNumber = partNumber;
  if (description !== undefined) sparePart.description = description;
  if (unit !== undefined) sparePart.unit = unit;
  if (minStock !== undefined) sparePart.minStock = minStock;
  if (maxStock !== undefined) sparePart.maxStock = maxStock;
  if (costPrice !== undefined) sparePart.costPrice = costPrice;
  if (sellingPrice !== undefined) sparePart.sellingPrice = sellingPrice;
  if (mrp !== undefined) sparePart.mrp = mrp;
  if (taxRate !== undefined) sparePart.taxRate = taxRate;
  if (location !== undefined) sparePart.location = location;
  if (vehicleCompatibility !== undefined)
    sparePart.vehicleCompatibility = vehicleCompatibility;
  if (supplier !== undefined) sparePart.supplier = supplier;
  if (warranty !== undefined) sparePart.warranty = warranty;
  if (isActive !== undefined) sparePart.isActive = isActive;

  await sparePart.save();

  ApiResponse.success(res, "Spare part updated successfully", sparePart);
});

/**
 * @desc    Delete spare part (soft delete)
 * @route   DELETE /api/v1/admin/inventory/:id
 * @access  Private/Admin
 */
const deleteSparePart = asyncHandler(async (req, res) => {
  const sparePart = await Inventory.findById(req.params.id);

  if (!sparePart) {
    throw ApiError.notFound("Spare part not found");
  }

  sparePart.isActive = false;
  await sparePart.save();

  ApiResponse.success(res, "Spare part deleted successfully");
});

// ============ Stock Management ============

/**
 * @desc    Add stock (purchase/restock)
 * @route   POST /api/v1/admin/inventory/:id/stock/add
 * @access  Private/Admin
 */
const addStock = asyncHandler(async (req, res) => {
  const { quantity, unitPrice, notes, supplier } = req.body;

  if (!quantity || quantity <= 0) {
    throw ApiError.badRequest("Quantity must be greater than 0");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sparePart = await Inventory.findById(req.params.id).session(session);

    if (!sparePart) {
      throw ApiError.notFound("Spare part not found");
    }

    const previousStock = sparePart.currentStock;
    const newStock = previousStock + quantity;

    // Update stock
    sparePart.currentStock = newStock;
    sparePart.lastRestocked = new Date();
    await sparePart.save({ session });

    // Create transaction log
    await InventoryTransaction.create(
      [
        {
          inventory: sparePart._id,
          type: "purchase",
          quantity: quantity,
          previousStock,
          newStock,
          unitPrice: unitPrice || sparePart.costPrice,
          totalAmount: quantity * (unitPrice || sparePart.costPrice),
          performedBy: req.userId,
          notes,
          supplier,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    ApiResponse.success(res, "Stock added successfully", {
      sparePart: sparePart.toJSON(),
      previousStock,
      addedQuantity: quantity,
      newStock,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Deduct stock (manual adjustment)
 * @route   POST /api/v1/admin/inventory/:id/stock/deduct
 * @access  Private/Admin
 */
const deductStock = asyncHandler(async (req, res) => {
  const { quantity, reason, notes } = req.body;

  if (!quantity || quantity <= 0) {
    throw ApiError.badRequest("Quantity must be greater than 0");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sparePart = await Inventory.findById(req.params.id).session(session);

    if (!sparePart) {
      throw ApiError.notFound("Spare part not found");
    }

    if (sparePart.currentStock < quantity) {
      throw ApiError.badRequest(
        `Insufficient stock. Available: ${sparePart.currentStock}`
      );
    }

    const previousStock = sparePart.currentStock;
    const newStock = previousStock - quantity;

    // Update stock
    sparePart.currentStock = newStock;
    sparePart.lastUsed = new Date();
    await sparePart.save({ session });

    // Create transaction log
    await InventoryTransaction.create(
      [
        {
          inventory: sparePart._id,
          type: reason === "damage" ? "damage" : "adjustment",
          quantity: -quantity,
          previousStock,
          newStock,
          performedBy: req.userId,
          notes: notes || reason,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Check for low stock alert
    if (newStock <= sparePart.minStock) {
      await sendLowStockAlert(sparePart);
    }

    ApiResponse.success(res, "Stock deducted successfully", {
      sparePart: sparePart.toJSON(),
      previousStock,
      deductedQuantity: quantity,
      newStock,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Adjust stock (set exact amount)
 * @route   POST /api/v1/admin/inventory/:id/stock/adjust
 * @access  Private/Admin
 */
const adjustStock = asyncHandler(async (req, res) => {
  const { newQuantity, notes } = req.body;

  if (newQuantity === undefined || newQuantity < 0) {
    throw ApiError.badRequest("New quantity must be 0 or greater");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sparePart = await Inventory.findById(req.params.id).session(session);

    if (!sparePart) {
      throw ApiError.notFound("Spare part not found");
    }

    const previousStock = sparePart.currentStock;
    const difference = newQuantity - previousStock;

    // Update stock
    sparePart.currentStock = newQuantity;
    if (difference > 0) {
      sparePart.lastRestocked = new Date();
    } else if (difference < 0) {
      sparePart.lastUsed = new Date();
    }
    await sparePart.save({ session });

    // Create transaction log
    await InventoryTransaction.create(
      [
        {
          inventory: sparePart._id,
          type: "adjustment",
          quantity: difference,
          previousStock,
          newStock: newQuantity,
          performedBy: req.userId,
          notes: notes || "Manual stock adjustment",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Check for low stock alert
    if (newQuantity <= sparePart.minStock) {
      await sendLowStockAlert(sparePart);
    }

    ApiResponse.success(res, "Stock adjusted successfully", {
      sparePart: sparePart.toJSON(),
      previousStock,
      newStock: newQuantity,
      difference,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// ============ Stock History ============

/**
 * @desc    Get stock history/transactions
 * @route   GET /api/v1/admin/inventory/transactions
 * @access  Private/Admin
 */
const getStockHistory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { partId, type, dateFrom, dateTo, referenceType } = req.query;

  const query = {};

  if (partId) query.inventory = partId;
  if (type) query.type = type;
  if (referenceType) query["reference.type"] = referenceType;

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const [transactions, total] = await Promise.all([
    InventoryTransaction.find(query)
      .populate("inventory", "name sku barcode category")
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InventoryTransaction.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Stock history fetched successfully",
    transactions,
    createPaginationMeta(total, page, limit)
  );
});

/**
 * @desc    Export stock history to CSV
 * @route   GET /api/v1/admin/inventory/transactions/export
 * @access  Private/Admin
 */
const exportStockHistory = asyncHandler(async (req, res) => {
  const { partId, type, dateFrom, dateTo } = req.query;

  const query = {};
  if (partId) query.inventory = partId;
  if (type) query.type = type;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  const transactions = await InventoryTransaction.find(query)
    .populate("inventory", "name sku barcode")
    .populate("performedBy", "name")
    .sort({ createdAt: -1 })
    .lean();

  // Generate CSV
  const headers = [
    "Transaction #",
    "Date",
    "Part Name",
    "SKU",
    "Type",
    "Quantity",
    "Previous Stock",
    "New Stock",
    "Unit Price",
    "Total Amount",
    "Performed By",
    "Notes",
  ];

  const rows = transactions.map((t) => [
    t.transactionNumber,
    new Date(t.createdAt).toISOString(),
    t.inventory?.name || "",
    t.inventory?.sku || "",
    t.type,
    t.quantity,
    t.previousStock,
    t.newStock,
    t.unitPrice || "",
    t.totalAmount || "",
    t.performedBy?.name || "",
    t.notes || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=stock-history-${Date.now()}.csv`
  );
  res.send(csv);
});

// ============ Low Stock Alerts ============

/**
 * @desc    Get low stock items
 * @route   GET /api/v1/admin/inventory/low-stock
 * @access  Private/Admin
 */
const getLowStockItems = asyncHandler(async (req, res) => {
  const lowStockItems = await Inventory.find({
    isActive: true,
    $expr: { $lte: ["$currentStock", "$minStock"] },
  })
    .sort({ currentStock: 1 })
    .lean();

  const categorized = {
    outOfStock: lowStockItems.filter((i) => i.currentStock === 0),
    lowStock: lowStockItems.filter((i) => i.currentStock > 0),
  };

  ApiResponse.success(res, "Low stock items fetched successfully", categorized);
});

/**
 * Send low stock push notification to admins
 */
const sendLowStockAlert = async (sparePart) => {
  try {
    // Get all admins
    const admins = await User.find({
      role: { $in: ["admin", "superadmin"] },
      isActive: true,
      "deviceInfo.fcmToken": { $exists: true, $ne: null },
    })
      .select("deviceInfo")
      .lean();

    const isOut = sparePart.currentStock === 0;
    const title = isOut ? "⚠️ Out of Stock Alert" : "📦 Low Stock Alert";
    const body = isOut
      ? `${sparePart.name} (${sparePart.sku}) is out of stock!`
      : `${sparePart.name} (${sparePart.sku}) is running low. Current: ${sparePart.currentStock}, Min: ${sparePart.minStock}`;

    for (const admin of admins) {
      await fcmService.sendNotification(admin, {
        title,
        body,
        data: {
          type: "inventory_alert",
          partId: sparePart._id.toString(),
          alertType: isOut ? "out_of_stock" : "low_stock",
        },
      });
    }
  } catch (error) {
    console.error("Failed to send low stock alert:", error);
  }
};

// ============ Invoice Integration ============

/**
 * @desc    Deduct stock for invoice/job card parts (atomic)
 * @route   POST /api/v1/admin/inventory/deduct-for-invoice
 * @access  Private/Admin
 */
const deductForInvoice = asyncHandler(async (req, res) => {
  const { parts, jobCardId, invoiceNumber } = req.body;

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    throw ApiError.badRequest("Parts array is required");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];
    const errors = [];

    for (const part of parts) {
      const { partId, quantity } = part;

      const sparePart = await Inventory.findById(partId).session(session);

      if (!sparePart) {
        errors.push({ partId, error: "Part not found" });
        continue;
      }

      if (sparePart.currentStock < quantity) {
        errors.push({
          partId,
          partName: sparePart.name,
          error: `Insufficient stock. Available: ${sparePart.currentStock}, Required: ${quantity}`,
        });
        continue;
      }

      const previousStock = sparePart.currentStock;
      const newStock = previousStock - quantity;

      // Update stock
      sparePart.currentStock = newStock;
      sparePart.lastUsed = new Date();
      await sparePart.save({ session });

      // Create transaction log
      await InventoryTransaction.create(
        [
          {
            inventory: sparePart._id,
            type: "sale",
            quantity: -quantity,
            previousStock,
            newStock,
            unitPrice: sparePart.sellingPrice,
            totalAmount: quantity * sparePart.sellingPrice,
            reference: {
              type: "jobcard",
              id: jobCardId,
              number: invoiceNumber,
            },
            performedBy: req.userId,
            notes: `Used in invoice ${invoiceNumber}`,
          },
        ],
        { session }
      );

      results.push({
        partId,
        partName: sparePart.name,
        previousStock,
        deducted: quantity,
        newStock,
      });

      // Queue low stock alert (after transaction)
      if (newStock <= sparePart.minStock) {
        // We'll send alerts after commit
        sparePart._sendLowStockAlert = true;
      }
    }

    // If any errors, abort transaction
    if (errors.length > 0) {
      await session.abortTransaction();
      throw ApiError.badRequest("Stock deduction failed", { errors });
    }

    await session.commitTransaction();

    // Send low stock alerts after successful commit
    for (const result of results) {
      const sparePart = await Inventory.findById(result.partId);
      if (sparePart && sparePart.currentStock <= sparePart.minStock) {
        await sendLowStockAlert(sparePart);
      }
    }

    ApiResponse.success(res, "Stock deducted for invoice successfully", {
      results,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Return stock from cancelled invoice
 * @route   POST /api/v1/admin/inventory/return-from-invoice
 * @access  Private/Admin
 */
const returnFromInvoice = asyncHandler(async (req, res) => {
  const { parts, jobCardId, invoiceNumber, reason } = req.body;

  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    throw ApiError.badRequest("Parts array is required");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];

    for (const part of parts) {
      const { partId, quantity } = part;

      const sparePart = await Inventory.findById(partId).session(session);

      if (!sparePart) {
        continue;
      }

      const previousStock = sparePart.currentStock;
      const newStock = previousStock + quantity;

      // Update stock
      sparePart.currentStock = newStock;
      await sparePart.save({ session });

      // Create transaction log
      await InventoryTransaction.create(
        [
          {
            inventory: sparePart._id,
            type: "return",
            quantity: quantity,
            previousStock,
            newStock,
            unitPrice: sparePart.sellingPrice,
            totalAmount: quantity * sparePart.sellingPrice,
            reference: {
              type: "jobcard",
              id: jobCardId,
              number: invoiceNumber,
            },
            performedBy: req.userId,
            notes: reason || `Returned from invoice ${invoiceNumber}`,
          },
        ],
        { session }
      );

      results.push({
        partId,
        partName: sparePart.name,
        previousStock,
        returned: quantity,
        newStock,
      });
    }

    await session.commitTransaction();

    ApiResponse.success(res, "Stock returned successfully", { results });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// ============ Categories ============

/**
 * @desc    Get category list with counts
 * @route   GET /api/v1/admin/inventory/categories
 * @access  Private/Admin
 */
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Inventory.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        totalStock: { $sum: "$currentStock" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  ApiResponse.success(res, "Categories fetched successfully", categories);
});

module.exports = {
  getDashboard,
  getSpareParts,
  getSparePart,
  getByBarcode,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  addStock,
  deductStock,
  adjustStock,
  getStockHistory,
  exportStockHistory,
  getLowStockItems,
  deductForInvoice,
  returnFromInvoice,
  getCategories,
};
