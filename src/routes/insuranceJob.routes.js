/**
 * Insurance Job Routes (Customer)
 */
const express = require("express");
const router = express.Router();
const { insuranceJobController } = require("../controllers");
const { authenticate, validateObjectId } = require("../middlewares");

router.use(authenticate);

router.get("/", insuranceJobController.listMyInsuranceJobs);
router.get(
  "/:id",
  validateObjectId("id"),
  insuranceJobController.getMyInsuranceJob
);

module.exports = router;
