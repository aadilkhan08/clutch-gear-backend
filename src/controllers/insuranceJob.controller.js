/**
 * Insurance Job Controller
 */
const { InsuranceJob, JobCard } = require("../models");
const { imagekitService } = require("../services");
const {
  ApiResponse,
  ApiError,
  asyncHandler,
  parsePagination,
  createPaginationMeta,
} = require("../utils");

const STATUS_ORDER = [
  "INITIATED",
  "DOCUMENTS_UPLOADED",
  "SURVEY_DONE",
  "APPROVED",
  "REJECTED",
  "SETTLED",];

const canTransition = (current, next) => {
  if (current === next) return true;
  if (current === "SETTLED" || current === "REJECTED") return false;
  const currentIndex = STATUS_ORDER.indexOf(current);
  const nextIndex = STATUS_ORDER.indexOf(next);
  return nextIndex === currentIndex + 1;
};

const listAdminInsuranceJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const { claimStatus, jobCardId } = req.query;
  const query = {};
  if (claimStatus) query.claimStatus = claimStatus;
  if (jobCardId) query.jobCardId = jobCardId;

  const [items, total] = await Promise.all([
    InsuranceJob.find(query)
      .populate("jobCardId", "jobNumber status")
      .populate("customerId", "name mobile")
      .populate("vehicleId", "vehicleNumber brand model")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    InsuranceJob.countDocuments(query),
  ]);

  ApiResponse.paginated(
    res,
    "Insurance jobs fetched",
    items,
    createPaginationMeta(total, page, limit)
  );
});

const getAdminInsuranceJob = asyncHandler(async (req, res) => {
  const item = await InsuranceJob.findById(req.params.id)
    .populate("jobCardId", "jobNumber status")
    .populate("customerId", "name mobile")
    .populate("vehicleId", "vehicleNumber brand model")
    .lean();

  if (!item) throw ApiError.notFound("Insurance job not found");
  ApiResponse.success(res, "Insurance job", item);
});

const createInsuranceJob = asyncHandler(async (req, res) => {
  const { jobCardId, insuranceProvider, policyNumber, claimType } = req.body;

  const jobCard = await JobCard.findById(jobCardId);
  if (!jobCard) throw ApiError.notFound("Job card not found");

  const existing = await InsuranceJob.findOne({ jobCardId });
  if (existing) throw ApiError.conflict("Insurance job already exists");

  const insuranceJob = await InsuranceJob.create({
    jobCardId,
    customerId: jobCard.customer,
    vehicleId: jobCard.vehicle,
    insuranceProvider,
    policyNumber,
    claimType,
    claimStatus: "INITIATED",
    statusHistory: [
      {
        status: "INITIATED",
        changedAt: new Date(),
        changedBy: req.userId,
      },
    ],
  });

  ApiResponse.created(res, "Insurance job created", insuranceJob);
});

const updateInsuranceDetails = asyncHandler(async (req, res) => {
  const insuranceJob = await InsuranceJob.findById(req.params.id);
  if (!insuranceJob) throw ApiError.notFound("Insurance job not found");

  if (req.body.insuranceProvider !== undefined) {
    insuranceJob.insuranceProvider = req.body.insuranceProvider;
  }
  if (req.body.policyNumber !== undefined) {
    insuranceJob.policyNumber = req.body.policyNumber;
  }
  if (req.body.claimType !== undefined) {
    insuranceJob.claimType = req.body.claimType;
  }

  await insuranceJob.save();
  ApiResponse.success(res, "Insurance job updated", insuranceJob);
});

const updateClaimStatus = asyncHandler(async (req, res) => {
  const { claimStatus, remarks } = req.body;
  const insuranceJob = await InsuranceJob.findById(req.params.id);
  if (!insuranceJob) throw ApiError.notFound("Insurance job not found");

  if (!canTransition(insuranceJob.claimStatus, claimStatus)) {
    throw ApiError.badRequest("Invalid claim status transition");
  }

  insuranceJob.claimStatus = claimStatus;
  insuranceJob.statusHistory = insuranceJob.statusHistory || [];
  insuranceJob.statusHistory.push({
    status: claimStatus,
    changedAt: new Date(),
    changedBy: req.userId,
    remarks,
  });

  await insuranceJob.save();
  ApiResponse.success(res, "Claim status updated", insuranceJob);
});

const uploadDocument = asyncHandler(async (req, res) => {
  const { type } = req.body;
  const insuranceJob = await InsuranceJob.findById(req.params.id);
  if (!insuranceJob) throw ApiError.notFound("Insurance job not found");

  if (!req.file) throw ApiError.badRequest("Document file is required");

  const upload = await imagekitService.uploadImage(
    req.file.buffer,
    req.file.originalname,
    `insurance/${insuranceJob.jobCardId}`
  );

  insuranceJob.documents = insuranceJob.documents || [];
  insuranceJob.documents.push({
    type,
    fileUrl: upload.url,
    fileId: upload.fileId,
    uploadedAt: new Date(),
    uploadedBy: req.userId,
  });

  if (insuranceJob.claimStatus === "INITIATED") {
    insuranceJob.claimStatus = "DOCUMENTS_UPLOADED";
    insuranceJob.statusHistory.push({
      status: "DOCUMENTS_UPLOADED",
      changedAt: new Date(),
      changedBy: req.userId,
      remarks: "Documents uploaded",
    });
  }

  await insuranceJob.save();
  ApiResponse.success(res, "Document uploaded", insuranceJob);
});

const deleteDocument = asyncHandler(async (req, res) => {
  const { docId } = req.params;
  const insuranceJob = await InsuranceJob.findById(req.params.id);
  if (!insuranceJob) throw ApiError.notFound("Insurance job not found");

  if (insuranceJob.claimStatus === "SETTLED") {
    throw ApiError.badRequest("Documents cannot be deleted after settlement");
  }

  const doc = insuranceJob.documents?.id(docId);
  if (!doc) throw ApiError.notFound("Document not found");

  if (doc.fileId) {
    try {
      await imagekitService.deleteImage(doc.fileId);
    } catch (error) {
      // Ignore delete errors to avoid blocking
    }
  }

  doc.remove();
  await insuranceJob.save();

  ApiResponse.success(res, "Document removed", insuranceJob);
});

const listMyInsuranceJobs = asyncHandler(async (req, res) => {
  const items = await InsuranceJob.find({ customerId: req.userId })
    .populate("jobCardId", "jobNumber status")
    .populate("vehicleId", "vehicleNumber brand model")
    .sort({ createdAt: -1 })
    .lean();

  ApiResponse.success(res, "Insurance jobs fetched", items);
});

const getMyInsuranceJob = asyncHandler(async (req, res) => {
  const item = await InsuranceJob.findOne({
    _id: req.params.id,
    customerId: req.userId,
  })
    .populate("jobCardId", "jobNumber status")
    .populate("vehicleId", "vehicleNumber brand model")
    .lean();

  if (!item) throw ApiError.notFound("Insurance job not found");
  ApiResponse.success(res, "Insurance job", item);
});

module.exports = {
  listAdminInsuranceJobs,
  getAdminInsuranceJob,
  createInsuranceJob,
  updateInsuranceDetails,
  updateClaimStatus,
  uploadDocument,
  deleteDocument,
  listMyInsuranceJobs,
  getMyInsuranceJob,
};
