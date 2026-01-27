/**
 * Washing Controller
 * Handles daily car washing operations, zone/area management, and reporting
 */
const mongoose = require("mongoose");
const { Zone, Area, CarWash, Vehicle, User } = require("../models");

/**
 * ==================== ZONE MANAGEMENT ====================
 */

/**
 * Get all zones
 */
exports.getZones = async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const filter = includeInactive === "true" ? {} : { isActive: true };

    const zones = await Zone.find(filter).sort({ name: 1 }).lean();

    // Get area counts for each zone
    const areaCounts = await Area.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$zone",
          count: { $sum: 1 },
          totalVehicles: { $sum: "$vehicleCount" },
        },
      },
    ]);

    const areaMap = {};
    areaCounts.forEach((a) => {
      areaMap[a._id.toString()] = {
        areaCount: a.count,
        totalVehicles: a.totalVehicles,
      };
    });

    const zonesWithCounts = zones.map((z) => ({
      ...z,
      areaCount: areaMap[z._id.toString()]?.areaCount || 0,
      totalVehicles:
        areaMap[z._id.toString()]?.totalVehicles || z.vehicleCount || 0,
    }));

    res.json({
      success: true,
      message: "Zones fetched successfully",
      data: { zones: zonesWithCounts },
    });
  } catch (error) {
    console.error("Get zones error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch zones",
      error: error.message,
    });
  }
};

/**
 * Create zone
 */
exports.createZone = async (req, res) => {
  try {
    const { name, code, description } = req.body;

    // Check for existing zone
    const existing = await Zone.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Zone with this name already exists",
      });
    }

    const zone = await Zone.create({
      name,
      code,
      description,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Zone created successfully",
      data: { zone },
    });
  } catch (error) {
    console.error("Create zone error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create zone",
      error: error.message,
    });
  }
};

/**
 * Update zone
 */
exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;

    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Check name uniqueness if changing
    if (name && name !== zone.name) {
      const existing = await Zone.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Zone with this name already exists",
        });
      }
    }

    zone.name = name || zone.name;
    zone.code = code || zone.code;
    zone.description =
      description !== undefined ? description : zone.description;
    zone.isActive = isActive !== undefined ? isActive : zone.isActive;
    zone.updatedBy = req.user._id;

    await zone.save();

    res.json({
      success: true,
      message: "Zone updated successfully",
      data: { zone },
    });
  } catch (error) {
    console.error("Update zone error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update zone",
      error: error.message,
    });
  }
};

/**
 * Delete zone
 */
exports.deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if zone has areas
    const areaCount = await Area.countDocuments({ zone: id });
    if (areaCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete zone with ${areaCount} areas. Please delete or reassign areas first.`,
      });
    }

    const zone = await Zone.findByIdAndDelete(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    res.json({
      success: true,
      message: "Zone deleted successfully",
    });
  } catch (error) {
    console.error("Delete zone error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete zone",
      error: error.message,
    });
  }
};

/**
 * ==================== AREA MANAGEMENT ====================
 */

/**
 * Get all areas (optionally filtered by zone)
 */
exports.getAreas = async (req, res) => {
  try {
    const { zoneId, includeInactive } = req.query;

    const filter = {};
    if (zoneId) filter.zone = zoneId;
    if (includeInactive !== "true") filter.isActive = true;

    const areas = await Area.find(filter)
      .populate("zone", "name code")
      .sort({ "zone.name": 1, name: 1 })
      .lean();

    res.json({
      success: true,
      message: "Areas fetched successfully",
      data: { areas },
    });
  } catch (error) {
    console.error("Get areas error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch areas",
      error: error.message,
    });
  }
};

/**
 * Create area
 */
exports.createArea = async (req, res) => {
  try {
    const { name, code, zoneId, description, pincode, landmarks } = req.body;

    // Verify zone exists
    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Check for existing area in zone
    const existing = await Area.findOne({
      zone: zoneId,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Area with this name already exists in the zone",
      });
    }

    const area = await Area.create({
      name,
      code,
      zone: zoneId,
      description,
      pincode,
      landmarks,
      createdBy: req.user._id,
    });

    await area.populate("zone", "name code");

    res.status(201).json({
      success: true,
      message: "Area created successfully",
      data: { area },
    });
  } catch (error) {
    console.error("Create area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create area",
      error: error.message,
    });
  }
};

/**
 * Update area
 */
exports.updateArea = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, zoneId, description, pincode, landmarks, isActive } =
      req.body;

    const area = await Area.findById(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    // If changing zone, verify new zone exists
    if (zoneId && zoneId !== area.zone.toString()) {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return res.status(404).json({
          success: false,
          message: "Zone not found",
        });
      }
    }

    // Check name uniqueness if changing
    const targetZone = zoneId || area.zone;
    if (name && name !== area.name) {
      const existing = await Area.findOne({
        zone: targetZone,
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Area with this name already exists in the zone",
        });
      }
    }

    area.name = name || area.name;
    area.code = code || area.code;
    area.zone = zoneId || area.zone;
    area.description =
      description !== undefined ? description : area.description;
    area.pincode = pincode !== undefined ? pincode : area.pincode;
    area.landmarks = landmarks || area.landmarks;
    area.isActive = isActive !== undefined ? isActive : area.isActive;
    area.updatedBy = req.user._id;

    await area.save();
    await area.populate("zone", "name code");

    res.json({
      success: true,
      message: "Area updated successfully",
      data: { area },
    });
  } catch (error) {
    console.error("Update area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update area",
      error: error.message,
    });
  }
};

/**
 * Delete area
 */
exports.deleteArea = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if area has wash logs
    const washCount = await CarWash.countDocuments({ area: id });
    if (washCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete area with ${washCount} wash records. Please deactivate instead.`,
      });
    }

    const area = await Area.findByIdAndDelete(id);
    if (!area) {
      return res.status(404).json({
        success: false,
        message: "Area not found",
      });
    }

    res.json({
      success: true,
      message: "Area deleted successfully",
    });
  } catch (error) {
    console.error("Delete area error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete area",
      error: error.message,
    });
  }
};

/**
 * ==================== DAILY WASHING ====================
 */

/**
 * Get washing dashboard stats
 */
exports.getDashboard = async (req, res) => {
  try {
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get today's wash summary
    const washStats = await CarWash.aggregate([
      {
        $match: {
          date: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      total: 0,
      completed: 0,
      pending: 0,
      skipped: 0,
      holiday: 0,
    };

    washStats.forEach((s) => {
      stats[s._id] = s.count;
      stats.total += s.count;
    });

    // Get zone-wise summary
    const zoneSummary = await CarWash.aggregate([
      {
        $match: {
          date: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: { zone: "$zone", status: "$status" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.zone",
          statuses: { $push: { status: "$_id.status", count: "$count" } },
          total: { $sum: "$count" },
        },
      },
      {
        $lookup: {
          from: "zones",
          localField: "_id",
          foreignField: "_id",
          as: "zoneInfo",
        },
      },
      { $unwind: { path: "$zoneInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          zoneName: "$zoneInfo.name",
          zoneCode: "$zoneInfo.code",
          statuses: 1,
          total: 1,
        },
      },
      { $sort: { zoneName: 1 } },
    ]);

    // Get total vehicles assigned for washing
    const totalVehicles = await Vehicle.countDocuments({
      "washSubscription.isActive": true,
    });

    res.json({
      success: true,
      message: "Dashboard fetched successfully",
      data: {
        date: targetDate.toISOString().split("T")[0],
        stats,
        zoneSummary,
        totalVehicles,
      },
    });
  } catch (error) {
    console.error("Get washing dashboard error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
      error: error.message,
    });
  }
};

/**
 * Get vehicles for washing (daily marking list)
 */
exports.getVehiclesForWashing = async (req, res) => {
  try {
    const { date, zoneId, areaId, status, page = 1, limit = 50 } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build filter for wash logs
    const washFilter = {
      date: { $gte: startOfDay, $lte: endOfDay },
    };
    if (zoneId) washFilter.zone = new mongoose.Types.ObjectId(zoneId);
    if (areaId) washFilter.area = new mongoose.Types.ObjectId(areaId);
    if (status) washFilter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get wash logs with vehicle and customer info
    const washLogs = await CarWash.find(washFilter)
      .populate("vehicle", "vehicleNumber brand model color vehicleType")
      .populate("customer", "name mobile")
      .populate("zone", "name code")
      .populate("area", "name code")
      .populate("washedBy", "name")
      .sort({ "zone.name": 1, "area.name": 1, createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await CarWash.countDocuments(washFilter);

    res.json({
      success: true,
      message: "Vehicles fetched successfully",
      data: {
        washLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get vehicles for washing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vehicles",
      error: error.message,
    });
  }
};

/**
 * Mark wash status for a vehicle
 */
exports.markWashStatus = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { date, status, remarks } = req.body;

    const targetDate = date ? new Date(date) : new Date();

    // Validate not future date
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (targetDate > today) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark wash status for future dates",
      });
    }

    // Validate status
    const validStatuses = ["pending", "completed", "skipped", "holiday"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Must be: pending, completed, skipped, or holiday",
      });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find or create wash log
    let washLog = await CarWash.findOne({
      vehicle: vehicleId,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (washLog) {
      // Update existing
      washLog.status = status;
      washLog.remarks = remarks || washLog.remarks;
      if (status === "completed") {
        washLog.completedAt = new Date();
        washLog.washedBy = req.user._id;
      }
      await washLog.save();
    } else {
      // Get vehicle info for zone/area
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // Create new wash log
      washLog = await CarWash.create({
        vehicle: vehicleId,
        customer: vehicle.owner,
        date: startOfDay,
        status,
        remarks,
        zone: vehicle.washZone,
        area: vehicle.washArea,
        washedBy: status === "completed" ? req.user._id : undefined,
        completedAt: status === "completed" ? new Date() : undefined,
      });
    }

    await washLog.populate([
      { path: "vehicle", select: "vehicleNumber brand model" },
      { path: "customer", select: "name mobile" },
      { path: "zone", select: "name code" },
      { path: "area", select: "name code" },
    ]);

    res.json({
      success: true,
      message: `Wash status updated to ${status}`,
      data: { washLog },
    });
  } catch (error) {
    console.error("Mark wash status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update wash status",
      error: error.message,
    });
  }
};

/**
 * Bulk mark wash status
 */
exports.bulkMarkStatus = async (req, res) => {
  try {
    const { vehicleIds, date, status, remarks } = req.body;

    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vehicle IDs array is required",
      });
    }

    const targetDate = date ? new Date(date) : new Date();

    // Validate not future date
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (targetDate > today) {
      return res.status(400).json({
        success: false,
        message: "Cannot mark wash status for future dates",
      });
    }

    const validStatuses = ["pending", "completed", "skipped", "holiday"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const updateData = {
      status,
      remarks: remarks || undefined,
      washedBy: status === "completed" ? req.user._id : undefined,
      completedAt: status === "completed" ? new Date() : undefined,
    };

    // Update existing logs
    const result = await CarWash.updateMany(
      {
        vehicle: { $in: vehicleIds },
        date: { $gte: startOfDay, $lte: endOfDay },
      },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} wash records`,
      data: { updated: result.modifiedCount },
    });
  } catch (error) {
    console.error("Bulk mark status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to bulk update status",
      error: error.message,
    });
  }
};

/**
 * Mark holiday for zone/area
 */
exports.markHoliday = async (req, res) => {
  try {
    const { date, zoneId, areaId, remarks } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filter = {
      date: { $gte: startOfDay, $lte: endOfDay },
    };
    if (zoneId) filter.zone = zoneId;
    if (areaId) filter.area = areaId;

    const result = await CarWash.updateMany(filter, {
      $set: {
        status: "holiday",
        remarks: remarks || "Holiday",
        washedBy: req.user._id,
      },
    });

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} vehicles as holiday`,
      data: { updated: result.modifiedCount },
    });
  } catch (error) {
    console.error("Mark holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark holiday",
      error: error.message,
    });
  }
};

/**
 * ==================== REPORTS ====================
 */

/**
 * Get daily washing report
 */
exports.getDailyReport = async (req, res) => {
  try {
    const { date, zoneId, areaId } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const matchStage = {
      date: { $gte: startOfDay, $lte: endOfDay },
    };
    if (zoneId) matchStage.zone = new mongoose.Types.ObjectId(zoneId);
    if (areaId) matchStage.area = new mongoose.Types.ObjectId(areaId);

    // Detailed report with zone/area breakdown
    const report = await CarWash.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "zones",
          localField: "zone",
          foreignField: "_id",
          as: "zoneInfo",
        },
      },
      { $unwind: { path: "$zoneInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "areas",
          localField: "area",
          foreignField: "_id",
          as: "areaInfo",
        },
      },
      { $unwind: { path: "$areaInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { zone: "$zone", area: "$area", status: "$status" },
          zoneName: { $first: "$zoneInfo.name" },
          areaName: { $first: "$areaInfo.name" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { zone: "$_id.zone", area: "$_id.area" },
          zoneName: { $first: "$zoneName" },
          areaName: { $first: "$areaName" },
          statuses: { $push: { status: "$_id.status", count: "$count" } },
          total: { $sum: "$count" },
        },
      },
      {
        $group: {
          _id: "$_id.zone",
          zoneName: { $first: "$zoneName" },
          areas: {
            $push: {
              areaId: "$_id.area",
              areaName: "$areaName",
              statuses: "$statuses",
              total: "$total",
            },
          },
          zoneTotal: { $sum: "$total" },
        },
      },
      { $sort: { zoneName: 1 } },
    ]);

    // Summary totals
    const summary = await CarWash.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totals = {
      total: 0,
      completed: 0,
      pending: 0,
      skipped: 0,
      holiday: 0,
    };
    summary.forEach((s) => {
      totals[s._id] = s.count;
      totals.total += s.count;
    });

    res.json({
      success: true,
      message: "Daily report generated",
      data: {
        date: targetDate.toISOString().split("T")[0],
        summary: totals,
        zoneBreakdown: report,
      },
    });
  } catch (error) {
    console.error("Get daily report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate daily report",
      error: error.message,
    });
  }
};

/**
 * Get monthly washing report
 */
exports.getMonthlyReport = async (req, res) => {
  try {
    const { year, month, zoneId, areaId } = req.query;

    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const matchStage = {
      date: { $gte: startDate, $lte: endDate },
    };
    if (zoneId) matchStage.zone = new mongoose.Types.ObjectId(zoneId);
    if (areaId) matchStage.area = new mongoose.Types.ObjectId(areaId);

    // Daily breakdown for the month
    const dailyBreakdown = await CarWash.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.date",
          statuses: { $push: { status: "$_id.status", count: "$count" } },
          total: { $sum: "$count" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly totals
    const summary = await CarWash.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totals = {
      total: 0,
      completed: 0,
      pending: 0,
      skipped: 0,
      holiday: 0,
    };
    summary.forEach((s) => {
      totals[s._id] = s.count;
      totals.total += s.count;
    });

    // Calculate completion rate
    const washableDays = totals.total - totals.holiday;
    const completionRate =
      washableDays > 0
        ? Math.round((totals.completed / washableDays) * 100)
        : 0;

    res.json({
      success: true,
      message: "Monthly report generated",
      data: {
        year: targetYear,
        month: targetMonth,
        monthName: startDate.toLocaleDateString("en-US", { month: "long" }),
        summary: totals,
        completionRate,
        dailyBreakdown,
      },
    });
  } catch (error) {
    console.error("Get monthly report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate monthly report",
      error: error.message,
    });
  }
};

/**
 * Export washing report (CSV format)
 */
exports.exportReport = async (req, res) => {
  try {
    const { startDate, endDate, zoneId, areaId, format = "csv" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const matchStage = {
      date: { $gte: start, $lte: end },
    };
    if (zoneId) matchStage.zone = new mongoose.Types.ObjectId(zoneId);
    if (areaId) matchStage.area = new mongoose.Types.ObjectId(areaId);

    const data = await CarWash.find(matchStage)
      .populate("vehicle", "vehicleNumber brand model")
      .populate("customer", "name mobile")
      .populate("zone", "name")
      .populate("area", "name")
      .populate("washedBy", "name")
      .sort({ date: 1, zone: 1, area: 1 })
      .lean();

    if (format === "json") {
      return res.json({
        success: true,
        message: "Report data exported",
        data: { records: data },
      });
    }

    // Generate CSV
    const csvRows = [
      [
        "Date",
        "Vehicle Number",
        "Brand",
        "Model",
        "Customer",
        "Mobile",
        "Zone",
        "Area",
        "Status",
        "Remarks",
        "Washed By",
      ],
    ];

    data.forEach((record) => {
      csvRows.push([
        record.date.toISOString().split("T")[0],
        record.vehicle?.vehicleNumber || "",
        record.vehicle?.brand || "",
        record.vehicle?.model || "",
        record.customer?.name || "",
        record.customer?.mobile || "",
        record.zone?.name || "",
        record.area?.name || "",
        record.status,
        record.remarks || "",
        record.washedBy?.name || "",
      ]);
    });

    const csv = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=washing-report-${startDate}-to-${endDate}.csv`
    );
    res.send(csv);
  } catch (error) {
    console.error("Export report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export report",
      error: error.message,
    });
  }
};

/**
 * Initialize daily wash entries (auto-create pending records)
 */
exports.initializeDailyWash = async (req, res) => {
  try {
    const { date, zoneId, areaId } = req.body;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get vehicles with active wash subscription
    const vehicleFilter = { "washSubscription.isActive": true };
    if (zoneId) vehicleFilter.washZone = zoneId;
    if (areaId) vehicleFilter.washArea = areaId;

    const vehicles = await Vehicle.find(vehicleFilter).lean();

    if (vehicles.length === 0) {
      return res.json({
        success: true,
        message: "No vehicles found for washing",
        data: { created: 0 },
      });
    }

    // Get existing wash logs for the date
    const existingLogs = await CarWash.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).distinct("vehicle");

    const existingSet = new Set(existingLogs.map((id) => id.toString()));

    // Create pending entries for vehicles without logs
    const newEntries = [];
    for (const vehicle of vehicles) {
      if (!existingSet.has(vehicle._id.toString())) {
        newEntries.push({
          vehicle: vehicle._id,
          customer: vehicle.owner,
          date: startOfDay,
          status: "pending",
          zone: vehicle.washZone,
          area: vehicle.washArea,
        });
      }
    }

    if (newEntries.length > 0) {
      await CarWash.insertMany(newEntries);
    }

    res.json({
      success: true,
      message: `Initialized ${newEntries.length} wash entries for ${
        targetDate.toISOString().split("T")[0]
      }`,
      data: { created: newEntries.length, total: vehicles.length },
    });
  } catch (error) {
    console.error("Initialize daily wash error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initialize daily wash entries",
      error: error.message,
    });
  }
};

/**
 * Assign vehicle to zone/area
 */
exports.assignVehicleToZone = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { zoneId, areaId, isActive, planName, startDate, endDate } = req.body;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (zoneId) {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        return res.status(404).json({
          success: false,
          message: "Zone not found",
        });
      }
      vehicle.washZone = zoneId;

      // Update zone vehicle count
      await Zone.findByIdAndUpdate(zoneId, { $inc: { vehicleCount: 1 } });
      if (vehicle.washZone && vehicle.washZone.toString() !== zoneId) {
        await Zone.findByIdAndUpdate(vehicle.washZone, {
          $inc: { vehicleCount: -1 },
        });
      }
    }

    if (areaId) {
      const area = await Area.findById(areaId);
      if (!area) {
        return res.status(404).json({
          success: false,
          message: "Area not found",
        });
      }
      vehicle.washArea = areaId;

      // Update area vehicle count
      await Area.findByIdAndUpdate(areaId, { $inc: { vehicleCount: 1 } });
      if (vehicle.washArea && vehicle.washArea.toString() !== areaId) {
        await Area.findByIdAndUpdate(vehicle.washArea, {
          $inc: { vehicleCount: -1 },
        });
      }
    }

    if (isActive !== undefined) {
      vehicle.washSubscription = vehicle.washSubscription || {};
      vehicle.washSubscription.isActive = isActive;
    }
    if (planName !== undefined) {
      vehicle.washSubscription = vehicle.washSubscription || {};
      vehicle.washSubscription.planName = planName;
    }
    if (startDate !== undefined) {
      vehicle.washSubscription = vehicle.washSubscription || {};
      vehicle.washSubscription.startDate = startDate
        ? new Date(startDate)
        : null;
    }
    if (endDate !== undefined) {
      vehicle.washSubscription = vehicle.washSubscription || {};
      vehicle.washSubscription.endDate = endDate ? new Date(endDate) : null;
    }

    await vehicle.save();

    res.json({
      success: true,
      message: "Vehicle assigned to zone/area successfully",
      data: { vehicle },
    });
  } catch (error) {
    console.error("Assign vehicle to zone error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign vehicle",
      error: error.message,
    });
  }
};

/**
 * ==================== CUSTOMER ENDPOINTS ====================
 */

/**
 * Get customer's wash history for a vehicle
 * @route GET /api/v1/washing/history/:vehicleId
 */
exports.getCustomerWashHistory = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { month, year, page = 1, limit = 31 } = req.query;

    // Verify vehicle belongs to customer
    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      owner: req.user._id,
      isActive: true,
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found or access denied",
      });
    }

    // Build date filter
    const now = new Date();
    let dateFilter = { $lte: now }; // Never show future dates

    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      dateFilter = {
        $gte: startDate,
        $lte: endDate > now ? now : endDate,
      };
    } else if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
      dateFilter = {
        $gte: startDate,
        $lte: endDate > now ? now : endDate,
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [washLogs, total] = await Promise.all([
      CarWash.find({
        vehicle: vehicleId,
        customer: req.user._id,
        date: dateFilter,
      })
        .select("date status washType completedAt notes skipReason zone area")
        .populate("zone", "name code")
        .populate("area", "name code")
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CarWash.countDocuments({
        vehicle: vehicleId,
        customer: req.user._id,
        date: dateFilter,
      }),
    ]);

    // Map status for customer-friendly display
    const mappedLogs = washLogs.map((log) => ({
      _id: log._id,
      date: log.date,
      status: mapWashStatus(log.status),
      originalStatus: log.status,
      washType: log.washType,
      completedAt: log.completedAt,
      zone: log.zone,
      area: log.area,
      notes: log.notes,
      skipReason: log.skipReason,
    }));

    res.json({
      success: true,
      message: "Wash history fetched successfully",
      data: {
        vehicle: {
          _id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          brand: vehicle.brand,
          model: vehicle.model,
        },
        washLogs: mappedLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get customer wash history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wash history",
      error: error.message,
    });
  }
};

/**
 * Get customer's wash summary for a month
 * @route GET /api/v1/washing/summary/:vehicleId
 */
exports.getCustomerWashSummary = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { month, year } = req.query;

    // Verify vehicle belongs to customer
    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      owner: req.user._id,
      isActive: true,
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found or access denied",
      });
    }

    // Default to current month
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const effectiveEndDate = endDate > now ? now : endDate;

    // Get summary counts
    const summary = await CarWash.aggregate([
      {
        $match: {
          vehicle: new mongoose.Types.ObjectId(vehicleId),
          customer: req.user._id,
          date: { $gte: startDate, $lte: effectiveEndDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate total days in month (up to today if current month)
    const totalDays = effectiveEndDate.getDate();

    // Build summary object
    const statusCounts = {
      washed: 0,
      notWashed: 0,
      holiday: 0,
      pending: 0,
    };

    summary.forEach((s) => {
      switch (s._id) {
        case "completed":
          statusCounts.washed = s.count;
          break;
        case "skipped":
        case "cancelled":
          statusCounts.notWashed += s.count;
          break;
        case "holiday":
          statusCounts.holiday = s.count;
          break;
        case "pending":
          statusCounts.pending = s.count;
          break;
      }
    });

    const totalRecords =
      statusCounts.washed +
      statusCounts.notWashed +
      statusCounts.holiday +
      statusCounts.pending;
    const washRate =
      totalRecords > 0
        ? Math.round(
            (statusCounts.washed / (totalRecords - statusCounts.holiday)) * 100
          )
        : 0;

    res.json({
      success: true,
      message: "Wash summary fetched successfully",
      data: {
        vehicle: {
          _id: vehicle._id,
          vehicleNumber: vehicle.vehicleNumber,
          brand: vehicle.brand,
          model: vehicle.model,
        },
        month: targetMonth + 1,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth).toLocaleString("default", {
          month: "long",
        }),
        totalDays,
        summary: statusCounts,
        washRate: isNaN(washRate) ? 0 : washRate,
      },
    });
  } catch (error) {
    console.error("Get customer wash summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wash summary",
      error: error.message,
    });
  }
};

/**
 * Get customer's vehicles with wash subscription
 * @route GET /api/v1/washing/my-vehicles
 */
exports.getCustomerWashVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      owner: req.user._id,
      isActive: true,
    })
      .select(
        "vehicleNumber brand model color vehicleType image washZone washArea washSubscription"
      )
      .populate("washZone", "name code")
      .populate("washArea", "name code")
      .lean();

    // Get today's wash status for each vehicle
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStatuses = await CarWash.find({
      customer: req.user._id,
      date: { $gte: today, $lt: tomorrow },
    })
      .select("vehicle status")
      .lean();

    const statusMap = {};
    todayStatuses.forEach((ws) => {
      statusMap[ws.vehicle.toString()] = mapWashStatus(ws.status);
    });

    const vehiclesWithStatus = vehicles.map((v) => ({
      ...v,
      todayWashStatus: statusMap[v._id.toString()] || null,
      hasWashSubscription: v.washSubscription?.isActive || false,
    }));

    res.json({
      success: true,
      message: "Vehicles fetched successfully",
      data: { vehicles: vehiclesWithStatus },
    });
  } catch (error) {
    console.error("Get customer wash vehicles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vehicles",
      error: error.message,
    });
  }
};

/**
 * Helper to map internal status to customer-friendly status
 */
function mapWashStatus(status) {
  switch (status) {
    case "completed":
      return "WASHED";
    case "skipped":
    case "cancelled":
      return "NOT_WASHED";
    case "holiday":
      return "HOLIDAY";
    case "pending":
      return "PENDING";
    default:
      return "NO_RECORD";
  }
}
