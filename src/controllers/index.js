/**
 * Controllers Index
 * Central export for all controllers
 */
const authController = require("./auth.controller");
const userController = require("./user.controller");
const vehicleController = require("./vehicle.controller");
const serviceController = require("./service.controller");
const appointmentController = require("./appointment.controller");
const jobcardController = require("./jobcard.controller");
const paymentController = require("./payment.controller");
const reviewController = require("./review.controller");
const garageController = require("./garage.controller");
const couponController = require("./coupon.controller");
const insuranceJobController = require("./insuranceJob.controller");
const adminController = require("./admin.controller");
const uploadController = require("./upload.controller");
const superadminController = require("./superadmin.controller");
const enquiryController = require("./enquiry.controller");
const inventoryController = require("./inventory.controller");
const packageController = require("./package.controller");
const subscriptionController = require("./subscription.controller");
const washingController = require("./washing.controller");
const serviceScheduleController = require("./serviceSchedule.controller");
const advancedPaymentController = require("./advancedPayment.controller");
const invoiceController = require("./invoice.controller");

module.exports = {
  authController,
  userController,
  vehicleController,
  serviceController,
  appointmentController,
  jobcardController,
  paymentController,
  reviewController,
  garageController,
  couponController,
  insuranceJobController,
  adminController,
  uploadController,
  superadminController,
  enquiryController,
  inventoryController,
  packageController,
  subscriptionController,
  washingController,
  serviceScheduleController,
  advancedPaymentController,
  invoiceController,
};
