/**
 * Models Index
 * Central export for all models
 */
const User = require("./user.model");
const OTP = require("./otp.model");
const Vehicle = require("./vehicle.model");
const Service = require("./service.model");
const TimeSlot = require("./timeslot.model");
const Appointment = require("./appointment.model");
const JobCard = require("./jobcard.model");
const Payment = require("./payment.model");
const RefundRequest = require("./refundRequest.model");
const Review = require("./review.model");
const AdminActivity = require("./adminActivity.model");
const Enquiry = require("./enquiry.model");

// Phase 2 Models
const Inventory = require("./inventory.model");
const InventoryTransaction = require("./inventoryTransaction.model");
const Package = require("./package.model");
const Subscription = require("./subscription.model");
const CarWash = require("./carwash.model");
const Coupon = require("./coupon.model");
const Garage = require("./garage.model");
const InsuranceJob = require("./insuranceJob.model");
const ServiceSchedule = require("./serviceSchedule.model");

// Car Washing Module
const Zone = require("./zone.model");
const Area = require("./area.model");

// Notifications
const Notification = require("./notification.model");

// Promotions
const Promotion = require("./promotion.model");

// Vehicle Catalog
const VehicleCatalog = require("./vehicleCatalog.model");

// Partners
const Partner = require("./partner.model");

module.exports = {
  User,
  OTP,
  Vehicle,
  Service,
  TimeSlot,
  Appointment,
  JobCard,
  Payment,
  RefundRequest,
  Review,
  AdminActivity,
  Enquiry,
  // Phase 2
  Inventory,
  InventoryTransaction,
  Package,
  Subscription,
  CarWash,
  Coupon,
  Garage,
  InsuranceJob,
  ServiceSchedule,
  // Car Washing
  Zone,
  Area,
  // Notifications
  Notification,
  // Promotions
  Promotion,
  // Vehicle Catalog
  VehicleCatalog,
  // Partners
  Partner,
};
