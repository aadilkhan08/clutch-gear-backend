/**
 * Testimonial Routes (Public)
 * Customer-facing testimonial endpoints
 */
const express = require("express");
const router = express.Router();
const { testimonialController } = require("../controllers");

// Public – get active testimonials (no auth required)
router.get("/active", testimonialController.getActiveTestimonials);

module.exports = router;
