/**
 * Garage Profile Controller
 * Manage public garage profile and trust information
 */
const { Garage, Review } = require("../models");
const { ApiResponse, ApiError, asyncHandler } = require("../utils");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dayNameToNumber = (dayName) => {
  if (!dayName) return null;
  const idx = DAY_NAMES.findIndex(
    (d) => d.toLowerCase() === String(dayName).toLowerCase()
  );
  return idx >= 0 ? idx : null;
};

const formatWorkingHours = (businessHours = []) =>
  businessHours
    .map((h) => ({
      day: DAY_NAMES[h.day] || "",
      open: h.openTime || "",
      close: h.closeTime || "",
      isOpen: h.isOpen !== false,
    }))
    .filter((h) => h.day);

const mapWorkingHoursToBusinessHours = (workingHours = []) => {
  return workingHours
    .map((h) => {
      const day = dayNameToNumber(h.day);
      if (day === null) return null;
      return {
        day,
        isOpen: h.isOpen !== false,
        openTime: h.open,
        closeTime: h.close,
      };
    })
    .filter(Boolean);
};

const buildProfileResponse = (garage) => {
  const workingHours = formatWorkingHours(garage?.businessHours || []);
  const todayHours = garage?.getTodayHours ? garage.getTodayHours() : null;

  return {
    _id: garage?._id,
    garageName: garage?.name || "",
    description: garage?.description || "",
    tagline: garage?.tagline || "",
    logo: garage?.logo?.url || "",
    address: {
      line1: garage?.address?.street || "",
      landmark: garage?.address?.landmark || "",
      city: garage?.address?.city || "",
      state: garage?.address?.state || "",
      pincode: garage?.address?.pincode || "",
      coordinates: {
        lat: garage?.address?.coordinates?.lat || null,
        lng: garage?.address?.coordinates?.lng || null,
      },
    },
    contact: {
      phone: garage?.contact?.phone || "",
      alternatePhone: garage?.contact?.alternatePhone || "",
      email: garage?.contact?.email || "",
      whatsapp: garage?.contact?.whatsapp || "",
    },
    workingHours,
    servicesOffered: garage?.servicesOffered || [],
    specialities: garage?.specialities || [],
    facilities: garage?.facilities || [],
    socialLinks: {
      googleMaps: garage?.social?.googleMaps || "",
      instagram: garage?.social?.instagram || "",
      facebook: garage?.social?.facebook || "",
      youtube: garage?.social?.youtube || "",
      twitter: garage?.social?.twitter || "",
      website: garage?.social?.website || "",
    },
    ratingSummary: {
      averageRating: garage?.ratings?.average || 0,
      totalReviews: garage?.ratings?.count || 0,
      distribution: garage?.ratings?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    stats: {
      totalCustomers: garage?.stats?.totalCustomers || 0,
      totalVehiclesServiced: garage?.stats?.totalVehiclesServiced || 0,
      yearsInBusiness: garage?.stats?.yearsInBusiness || garage?.establishedYear 
        ? new Date().getFullYear() - garage.establishedYear 
        : 0,
    },
    openStatus: {
      isOpenNow: garage?.isOpenNow ? garage.isOpenNow() : false,
      today: todayHours
        ? {
            day: DAY_NAMES[todayHours.day],
            open: todayHours.openTime,
            close: todayHours.closeTime,
            isOpen: todayHours.isOpen !== false,
          }
        : null,
    },
    isActive: garage?.isActive ?? false,
    isVerified: garage?.isVerified ?? false,
    establishedYear: garage?.establishedYear || null,
    updatedAt: garage?.updatedAt || garage?.createdAt || null,
  };
};

/**
 * @desc    Get public garage profile
 * @route   GET /api/v1/garage/profile
 * @access  Public
 */
const getPublicProfile = asyncHandler(async (req, res) => {
  const garage = await Garage.findOne({ isActive: true });

  if (!garage) {
    return ApiResponse.success(
      res,
      "Garage profile",
      buildProfileResponse(null)
    );
  }

  ApiResponse.success(res, "Garage profile", buildProfileResponse(garage));
});

/**
 * @desc    Get admin garage profile
 * @route   GET /api/v1/admin/garage/profile
 * @access  Private/Admin
 */
const getAdminProfile = asyncHandler(async (req, res) => {
  const garage = await Garage.findOne();
  ApiResponse.success(res, "Garage profile", buildProfileResponse(garage));
});

/**
 * @desc    Update garage profile (Admin)
 * @route   PUT /api/v1/admin/garage/profile
 * @access  Private/Admin
 */
const updateProfile = asyncHandler(async (req, res) => {
  const {
    garageName,
    description,
    address,
    contact,
    workingHours,
    servicesOffered,
    socialLinks,
    isActive,
  } = req.body;

  let garage = await Garage.findOne();

  if (!garage) {
    if (
      !garageName ||
      !address?.line1 ||
      !address?.city ||
      !address?.state ||
      !address?.pincode ||
      !contact?.phone
    ) {
      throw ApiError.badRequest("Garage name, address, and phone are required");
    }

    garage = new Garage({
      name: garageName,
      description,
      address: {
        street: address?.line1,
        city: address?.city,
        state: address?.state,
        pincode: address?.pincode,
      },
      contact: {
        phone: contact?.phone,
        email: contact?.email,
      },
      businessHours: mapWorkingHoursToBusinessHours(workingHours || []),
      servicesOffered: servicesOffered || [],
      social: {
        googleMaps: socialLinks?.googleMaps,
        instagram: socialLinks?.instagram,
        website: socialLinks?.website,
      },
      isActive: isActive !== false,
    });
  } else {
    if (!garage.address) garage.address = {};
    if (!garage.contact) garage.contact = {};
    if (!garage.social) garage.social = {};
    if (garageName !== undefined) garage.name = garageName;
    if (description !== undefined) garage.description = description;
    if (address?.line1 !== undefined) garage.address.street = address.line1;
    if (address?.city !== undefined) garage.address.city = address.city;
    if (address?.state !== undefined) garage.address.state = address.state;
    if (address?.pincode !== undefined)
      garage.address.pincode = address.pincode;
    if (contact?.phone !== undefined) garage.contact.phone = contact.phone;
    if (contact?.email !== undefined) garage.contact.email = contact.email;
    if (Array.isArray(workingHours)) {
      garage.businessHours = mapWorkingHoursToBusinessHours(workingHours);
    }
    if (Array.isArray(servicesOffered)) {
      garage.servicesOffered = servicesOffered;
    }
    if (socialLinks?.googleMaps !== undefined) {
      garage.social.googleMaps = socialLinks.googleMaps;
    }
    if (socialLinks?.instagram !== undefined) {
      garage.social.instagram = socialLinks.instagram;
    }
    if (socialLinks?.website !== undefined) {
      garage.social.website = socialLinks.website;
    }
    if (typeof isActive === "boolean") {
      garage.isActive = isActive;
    }
  }

  await garage.save();

  ApiResponse.success(
    res,
    "Garage profile updated",
    buildProfileResponse(garage)
  );
});

/**
 * @desc    Recalculate rating summary cache
 * @route   POST /api/v1/admin/garage/ratings/recalculate
 * @access  Private/Admin
 */
const recalculateRatings = asyncHandler(async (req, res) => {
  const garage = await Garage.findOne();
  if (!garage) throw ApiError.notFound("Garage profile not found");

  const stats = await Review.aggregate([
    { $match: { isPublic: true, isVerified: true } },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  const distributionAgg = await Review.aggregate([
    { $match: { isPublic: true, isVerified: true } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  distributionAgg.forEach((d) => {
    distribution[d._id] = d.count;
  });

  garage.ratings.average = Math.round((stats?.[0]?.average || 0) * 10) / 10;
  garage.ratings.count = stats?.[0]?.count || 0;
  garage.ratings.distribution = distribution;
  await garage.save();

  ApiResponse.success(
    res,
    "Garage rating summary updated",
    buildProfileResponse(garage)
  );
});

module.exports = {
  getPublicProfile,
  getAdminProfile,
  updateProfile,
  recalculateRatings,
};
