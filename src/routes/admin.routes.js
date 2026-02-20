/**
 * Admin Routes
 * All admin-only endpoints
 */
const express = require("express");
const multer = require("multer");
const config = require("../config");
const router = express.Router();
const {
  adminController,
  appointmentController,
  jobcardController,
  paymentController,
  advancedPaymentController,
  reviewController,
  enquiryController,
  packageController,
  subscriptionController,
  garageController,
  couponController,
  insuranceJobController,
  invoiceController,
  promotionController,
  partnerController,
} = require("../controllers");
const {
  authenticate,
  isAdmin,
  validate,
  validateObjectId,
} = require("../middlewares");
const {
  updateAppointmentValidation,
  updateUserRoleValidation,
  createJobCardValidation,
  updateJobCardValidation,
  addJobItemValidation,
  updateBillingValidation,
  assignMechanicsValidation,
  createPaymentValidation,
  updatePaymentValidation,
  refundPaymentValidation,
  createInvoicePaymentValidation,
  addTransactionValidation,
  markPaidValidation,
  refundRequestValidation,
  refundActionValidation,
  listPaymentValidation,
  adminResponseValidation,
  updateGarageProfileValidation,
  createCouponValidation,
  updateCouponValidation,
  listCouponValidation,
  createInsuranceJobValidation,
  updateInsuranceDetailsValidation,
  updateClaimStatusValidation,
  uploadDocumentValidation,
  listInsuranceJobValidation,
  createWalkInCustomerValidation,
  createEnquiryValidation,
  updateEnquiryValidation,
  addFollowUpValidation,
  assignEnquiryValidation,
  convertEnquiryValidation,
  createPackageValidation,
  updatePackageValidation,
  useServiceValidation,
  activateSubscriptionValidation,
  cancelSubscriptionValidation,
  extendSubscriptionValidation,
  createPromotionValidation,
  updatePromotionValidation,
  listPromotionValidation,
  createPartnerValidation,
  updatePartnerValidation,
  listPartnerValidation,
} = require("../validators");

// Image upload config
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxImageSize },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Video upload config
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxVideoSize },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

// Mixed media upload config (images + videos)
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxVideoSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...config.upload.allowedImageTypes,
      ...config.upload.allowedVideoTypes,
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed"), false);
    }
  },
});

// Insurance document upload (images + PDF)
const insuranceDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxImageSize },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...config.upload.allowedImageTypes,
      "application/pdf",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image or PDF files are allowed"), false);
    }
  },
});

// All routes require admin authentication
router.use(authenticate, isAdmin);

// Dashboard
router.get("/dashboard", adminController.getDashboard);

// Analytics
router.get("/analytics/revenue", adminController.getRevenueAnalytics);
router.get("/analytics/services", adminController.getServiceAnalytics);

// User Management
router.get("/users", adminController.getAllUsers);
router.get(
  "/users/:id",
  validateObjectId("id"),
  adminController.getUserDetails,
);
router.put(
  "/users/:id/status",
  validateObjectId("id"),
  adminController.updateUserStatus,
);

// Customer Management (Walk-in)
router.get("/customers", adminController.getAllCustomers);
router.post(
  "/customers/walk-in",
  createWalkInCustomerValidation,
  validate,
  adminController.createWalkInCustomer,
);
router.get(
  "/customers/:id/vehicles",
  validateObjectId("id"),
  adminController.getCustomerVehicles,
);
router.post(
  "/customers/:id/vehicles",
  validateObjectId("id"),
  adminController.addCustomerVehicle,
);
router.get(
  "/customers/:id/history",
  validateObjectId("id"),
  adminController.getCustomerServiceHistory,
);

// Mechanic role management (admin-controlled)
router.get("/mechanics", adminController.listMechanics);
router.get(
  "/mechanics/:id",
  validateObjectId("id"),
  adminController.getMechanic,
);
router.get("/mechanics/workload", adminController.getAllMechanicsWorkload);
router.get("/mechanics/workload/all", adminController.getAllMechanicsWorkload);
router.get(
  "/mechanics/:id/workload",
  validateObjectId("id"),
  adminController.getMechanicWorkload,
);
router.put(
  "/users/:id/role",
  validateObjectId("id"),
  updateUserRoleValidation,
  validate,
  adminController.updateUserRole,
);
// Admin creation/promotions are restricted to Super Admin via /superadmin endpoints

// Time Slots
router.get("/timeslots", adminController.getTimeSlots);
router.post("/timeslots", adminController.upsertTimeSlot);
router.delete(
  "/timeslots/:id",
  validateObjectId("id"),
  adminController.deleteTimeSlot,
);

// Appointments
router.get("/appointments", appointmentController.getAllAppointments);
router.get("/appointments/today", appointmentController.getTodayAppointments);
router.get(
  "/appointments/:id",
  validateObjectId("id"),
  appointmentController.getAdminAppointment,
);
router.put(
  "/appointments/:id",
  validateObjectId("id"),
  updateAppointmentValidation,
  validate,
  appointmentController.updateAppointment,
);

// Job Cards
router.get("/jobcards", jobcardController.getAllJobCards);
router.get("/jobcards/stats", jobcardController.getJobCardStats);
router.get(
  "/jobcards/:id",
  validateObjectId("id"),
  jobcardController.getJobCardById,
);
router.post(
  "/jobcards",
  createJobCardValidation,
  validate,
  jobcardController.createJobCard,
);
router.put(
  "/jobcards/:id",
  validateObjectId("id"),
  updateJobCardValidation,
  validate,
  jobcardController.updateJobCard,
);
router.put(
  "/jobcards/:id/assign-mechanics",
  validateObjectId("id"),
  assignMechanicsValidation,
  validate,
  jobcardController.assignMechanics,
);
router.put(
  "/jobcards/:id/estimate",
  validateObjectId("id"),
  jobcardController.createOrUpdateEstimate,
);
router.post(
  "/jobcards/:id/items",
  validateObjectId("id"),
  addJobItemValidation,
  validate,
  jobcardController.addJobItem,
);
router.delete(
  "/jobcards/:id/items/:itemId",
  validateObjectId("id"),
  jobcardController.removeJobItem,
);
router.put(
  "/jobcards/:id/billing",
  validateObjectId("id"),
  updateBillingValidation,
  validate,
  jobcardController.updateBilling,
);
router.post(
  "/jobcards/:id/images",
  validateObjectId("id"),
  imageUpload.array("images", 10),
  jobcardController.uploadJobCardImages,
);

// Video uploads for job cards
router.post(
  "/jobcards/:id/videos",
  validateObjectId("id"),
  videoUpload.array("videos", 5),
  jobcardController.uploadJobCardVideos,
);

// Mixed media uploads for job cards
router.post(
  "/jobcards/:id/media",
  validateObjectId("id"),
  mediaUpload.array("media", 15),
  jobcardController.uploadJobCardMedia,
);

// Payments
router.get("/payments", paymentController.getAllPayments);
router.get("/payments/summary", paymentController.getPaymentSummary);
router.get("/payments/today", paymentController.getTodayCollection);
router.post(
  "/payments",
  createPaymentValidation,
  validate,
  paymentController.createPayment,
);
router.post(
  "/payments/:id/razorpay/order",
  validateObjectId("id"),
  paymentController.createRazorpayOrderForPaymentAdmin,
);
router.post(
  "/payments/:id/razorpay/verify",
  validateObjectId("id"),
  paymentController.verifyRazorpayPaymentNative,
);
router.put(
  "/payments/:id",
  validateObjectId("id"),
  updatePaymentValidation,
  validate,
  paymentController.updatePayment,
);
router.post(
  "/payments/:id/refund",
  validateObjectId("id"),
  refundPaymentValidation,
  validate,
  paymentController.processRefund,
);
// Advanced Payments
router.get(
  "/payments/advanced/dashboard",
  advancedPaymentController.adminDashboard,
);
router.get(
  "/payments/advanced",
  listPaymentValidation,
  validate,
  advancedPaymentController.listAdminPayments,
);
router.post(
  "/payments/advanced",
  createInvoicePaymentValidation,
  validate,
  advancedPaymentController.createInvoicePayment,
);
router.post(
  "/payments/advanced/:id/transactions",
  addTransactionValidation,
  validate,
  advancedPaymentController.addTransaction,
);
router.post(
  "/payments/advanced/:id/mark-paid",
  markPaidValidation,
  validate,
  advancedPaymentController.markPaid,
);

// Refund Requests
router.get("/refunds", advancedPaymentController.listRefundsAdmin);
router.put(
  "/refunds/:id/approve",
  refundActionValidation,
  validate,
  advancedPaymentController.approveRefund,
);
router.put(
  "/refunds/:id/reject",
  refundActionValidation,
  validate,
  advancedPaymentController.rejectRefund,
);
router.put(
  "/refunds/:id/process",
  refundActionValidation,
  validate,
  advancedPaymentController.processRefund,
);
// Invoice PDF download
router.get(
  "/payments/:id/invoice",
  validateObjectId("id"),
  paymentController.downloadInvoice,
);

// Reviews
router.get("/reviews", reviewController.getAllReviews);
router.get("/reviews/analytics", reviewController.getReviewAnalytics);
router.put(
  "/reviews/:id/respond",
  validateObjectId("id"),
  adminResponseValidation,
  validate,
  reviewController.respondToReview,
);
router.put(
  "/reviews/:id/visibility",
  validateObjectId("id"),
  reviewController.toggleVisibility,
);
router.put(
  "/reviews/:id/status",
  validateObjectId("id"),
  reviewController.updateReviewStatus,
);

// Coupons
router.get(
  "/coupons",
  listCouponValidation,
  validate,
  couponController.listAdminCoupons,
);
router.get("/coupons/analytics", couponController.getCouponAnalytics);
router.post(
  "/coupons",
  createCouponValidation,
  validate,
  couponController.createCoupon,
);
router.put(
  "/coupons/:id",
  validateObjectId("id"),
  updateCouponValidation,
  validate,
  couponController.updateCoupon,
);
router.put(
  "/coupons/:id/toggle",
  validateObjectId("id"),
  couponController.toggleCoupon,
);

// Insurance Jobs
router.get(
  "/insurance-jobs",
  listInsuranceJobValidation,
  validate,
  insuranceJobController.listAdminInsuranceJobs,
);
router.post(
  "/insurance-jobs",
  createInsuranceJobValidation,
  validate,
  insuranceJobController.createInsuranceJob,
);
router.get(
  "/insurance-jobs/:id",
  validateObjectId("id"),
  insuranceJobController.getAdminInsuranceJob,
);
router.put(
  "/insurance-jobs/:id",
  validateObjectId("id"),
  updateInsuranceDetailsValidation,
  validate,
  insuranceJobController.updateInsuranceDetails,
);
router.put(
  "/insurance-jobs/:id/status",
  validateObjectId("id"),
  updateClaimStatusValidation,
  validate,
  insuranceJobController.updateClaimStatus,
);
router.post(
  "/insurance-jobs/:id/documents",
  validateObjectId("id"),
  insuranceDocUpload.single("document"),
  uploadDocumentValidation,
  validate,
  insuranceJobController.uploadDocument,
);
router.delete(
  "/insurance-jobs/:id/documents/:docId",
  validateObjectId("id"),
  validateObjectId("docId"),
  insuranceJobController.deleteDocument,
);

// Garage Profile
router.get("/garage/profile", garageController.getAdminProfile);
router.put(
  "/garage/profile",
  updateGarageProfileValidation,
  validate,
  garageController.updateProfile,
);
router.post("/garage/ratings/recalculate", garageController.recalculateRatings);

// ============ Enquiry/Lead Management ============
router.get("/enquiries/stats", enquiryController.getEnquiryStats);
router.get("/enquiries", enquiryController.getEnquiries);
router.post(
  "/enquiries",
  createEnquiryValidation,
  validate,
  enquiryController.createEnquiry,
);
router.get(
  "/enquiries/:id",
  validateObjectId("id"),
  enquiryController.getEnquiry,
);
router.put(
  "/enquiries/:id",
  validateObjectId("id"),
  updateEnquiryValidation,
  validate,
  enquiryController.updateEnquiry,
);
router.post(
  "/enquiries/:id/follow-up",
  validateObjectId("id"),
  addFollowUpValidation,
  validate,
  enquiryController.addFollowUp,
);
router.put(
  "/enquiries/:id/assign",
  validateObjectId("id"),
  assignEnquiryValidation,
  validate,
  enquiryController.assignEnquiry,
);
router.post(
  "/enquiries/:id/convert",
  validateObjectId("id"),
  convertEnquiryValidation,
  validate,
  enquiryController.convertEnquiry,
);
router.delete(
  "/enquiries/:id",
  validateObjectId("id"),
  enquiryController.deleteEnquiry,
);

// ============ Package Management ============
router.get("/packages/stats", packageController.getPackageStats);
router.get("/packages", packageController.getAllPackages);
router.get(
  "/packages/:id",
  validateObjectId("id"),
  packageController.getPackageById,
);
router.post(
  "/packages",
  createPackageValidation,
  validate,
  packageController.createPackage,
);
router.put(
  "/packages/:id",
  validateObjectId("id"),
  updatePackageValidation,
  validate,
  packageController.updatePackage,
);
router.put(
  "/packages/:id/toggle-status",
  validateObjectId("id"),
  packageController.togglePackageStatus,
);
router.delete(
  "/packages/:id",
  validateObjectId("id"),
  packageController.deletePackage,
);

// ============ Subscription Management ============
router.get(
  "/subscriptions/reports/usage",
  subscriptionController.getUsageReport,
);
router.post(
  "/subscriptions/expire-check",
  subscriptionController.expireSubscriptions,
);
router.get("/subscriptions", subscriptionController.getAllSubscriptions);
router.get(
  "/subscriptions/:id",
  validateObjectId("id"),
  subscriptionController.getSubscriptionDetails,
);
router.post(
  "/subscriptions/:id/activate",
  validateObjectId("id"),
  activateSubscriptionValidation,
  validate,
  subscriptionController.activateSubscription,
);
router.post(
  "/subscriptions/:id/cancel",
  validateObjectId("id"),
  cancelSubscriptionValidation,
  validate,
  subscriptionController.cancelSubscription,
);
router.post(
  "/subscriptions/:id/extend",
  validateObjectId("id"),
  extendSubscriptionValidation,
  validate,
  subscriptionController.extendSubscription,
);
router.post(
  "/subscriptions/:id/use-service",
  validateObjectId("id"),
  useServiceValidation,
  validate,
  subscriptionController.useSubscriptionService,
);

// ============ Invoice Management ============
router.get("/invoices", invoiceController.getInvoicesAdmin);
router.get(
  "/invoices/:id",
  validateObjectId("id"),
  invoiceController.getInvoiceAdmin,
);
router.get(
  "/invoices/:id/pdf",
  validateObjectId("id"),
  invoiceController.downloadInvoicePDFAdmin,
);
router.put(
  "/invoices/:id/cancel",
  validateObjectId("id"),
  invoiceController.cancelInvoice,
);
router.post(
  "/jobcards/:id/generate-invoice",
  validateObjectId("id"),
  invoiceController.generateInvoiceFromJobCard,
);

// ============ Promotion Management ============
router.get(
  "/promotions",
  listPromotionValidation,
  validate,
  promotionController.listPromotions,
);
router.get("/promotions/analytics", promotionController.getPromotionAnalytics);
router.get(
  "/promotions/:id",
  validateObjectId("id"),
  promotionController.getPromotion,
);
router.post(
  "/promotions",
  createPromotionValidation,
  validate,
  promotionController.createPromotion,
);
router.put(
  "/promotions/:id",
  validateObjectId("id"),
  updatePromotionValidation,
  validate,
  promotionController.updatePromotion,
);
router.put(
  "/promotions/:id/toggle",
  validateObjectId("id"),
  promotionController.togglePromotion,
);
router.delete(
  "/promotions/:id",
  validateObjectId("id"),
  promotionController.deletePromotion,
);

// ============ Partner Management ============
router.get(
  "/partners",
  listPartnerValidation,
  validate,
  partnerController.listPartners,
);
router.get(
  "/partners/:id",
  validateObjectId("id"),
  partnerController.getPartner,
);
router.post(
  "/partners",
  createPartnerValidation,
  validate,
  partnerController.createPartner,
);
router.put(
  "/partners/:id",
  validateObjectId("id"),
  updatePartnerValidation,
  validate,
  partnerController.updatePartner,
);
router.put(
  "/partners/:id/toggle",
  validateObjectId("id"),
  partnerController.togglePartner,
);
router.delete(
  "/partners/:id",
  validateObjectId("id"),
  partnerController.deletePartner,
);

module.exports = router;
