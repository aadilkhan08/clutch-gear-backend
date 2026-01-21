/**
 * Validators Index
 * Central export for all validators
 */
const authValidator = require("./auth.validator");
const userValidator = require("./user.validator");
const vehicleValidator = require("./vehicle.validator");
const appointmentValidator = require("./appointment.validator");
const serviceValidator = require("./service.validator");
const jobcardValidator = require("./jobcard.validator");
const paymentValidator = require("./payment.validator");
const reviewValidator = require("./review.validator");
const garageValidator = require("./garage.validator");
const couponValidator = require("./coupon.validator");
const insuranceJobValidator = require("./insuranceJob.validator");
const customerValidator = require("./customer.validator");
const enquiryValidator = require("./enquiry.validator");
const packageValidator = require("./package.validator");
const subscriptionValidator = require("./subscription.validator");
const washingValidator = require("./washing.validator");
const serviceScheduleValidator = require("./serviceSchedule.validator");
const advancedPaymentValidator = require("./advancedPayment.validator");

module.exports = {
  ...authValidator,
  ...userValidator,
  ...vehicleValidator,
  ...appointmentValidator,
  ...serviceValidator,
  ...jobcardValidator,
  ...paymentValidator,
  ...reviewValidator,
  ...garageValidator,
  ...couponValidator,
  ...insuranceJobValidator,
  ...customerValidator,
  ...enquiryValidator,
  ...packageValidator,
  ...subscriptionValidator,
  ...washingValidator,
  ...serviceScheduleValidator,
  ...advancedPaymentValidator,
};
