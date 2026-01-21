/**
 * Insurance Job Validators
 */
const { body, param, query } = require("express-validator");

const createInsuranceJobValidation = [
  body("jobCardId").isMongoId().withMessage("Job card is required"),
  body("insuranceProvider")
    .notEmpty()
    .withMessage("Insurance provider is required"),
  body("policyNumber").notEmpty().withMessage("Policy number is required"),
  body("claimType")
    .isIn(["CASHLESS", "REIMBURSEMENT"])
    .withMessage("Invalid claim type"),
];

const updateInsuranceDetailsValidation = [
  body("insuranceProvider").optional().isLength({ min: 2, max: 200 }),
  body("policyNumber").optional().isLength({ min: 2, max: 100 }),
  body("claimType")
    .optional()
    .isIn(["CASHLESS", "REIMBURSEMENT"])
    .withMessage("Invalid claim type"),
];

const updateClaimStatusValidation = [
  body("claimStatus")
    .isIn([
      "INITIATED",
      "DOCUMENTS_UPLOADED",
      "APPROVED",
      "REJECTED",
      "SETTLED",
    ])
    .withMessage("Invalid claim status"),
  body("remarks").optional().isLength({ max: 500 }),
];

const uploadDocumentValidation = [
  param("id").isMongoId().withMessage("Invalid insurance job ID"),
  body("type")
    .isIn(["RC", "POLICY", "SURVEY", "INVOICE"])
    .withMessage("Invalid document type"),
];

const listInsuranceJobValidation = [
  query("claimStatus")
    .optional()
    .isIn([
      "INITIATED",
      "DOCUMENTS_UPLOADED",
      "APPROVED",
      "REJECTED",
      "SETTLED",
    ]),
];

module.exports = {
  createInsuranceJobValidation,
  updateInsuranceDetailsValidation,
  updateClaimStatusValidation,
  uploadDocumentValidation,
  listInsuranceJobValidation,
};
