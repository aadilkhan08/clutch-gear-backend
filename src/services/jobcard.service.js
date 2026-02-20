/**
 * Job Card Service
 * Handles automatic job card creation from appointments
 */
const { JobCard, Vehicle, Service, Appointment } = require("../models");

/**
 * Create a job card automatically from a confirmed appointment.
 *
 * Maps the appointment's selected services into job card `services` refs
 * and builds `jobItems` (type "service") from each Service document so the
 * admin already sees a pre-populated cost breakdown.
 *
 * @param {Object} appointment – saved Appointment document (must have _id, customer, vehicle, services[])
 * @returns {Object} the created JobCard document (populated)
 */
const createJobCardFromAppointment = async (appointment) => {
    // Populate full service details if not already populated
    const serviceIds = appointment.services.map((s) =>
        s.service?._id ? s.service._id : s.service,
    );

    const serviceDetails = await Service.find({ _id: { $in: serviceIds } }).lean();

    // Build a quick lookup by id
    const serviceMap = {};
    serviceDetails.forEach((svc) => {
        serviceMap[svc._id.toString()] = svc;
    });

    // Get vehicle snapshot
    const vehicle = await Vehicle.findById(appointment.vehicle).lean();

    // Build jobItems from the booked services
    const jobItems = appointment.services.map((s) => {
        const svcId = s.service?._id ? s.service._id.toString() : s.service.toString();
        const svc = serviceMap[svcId];
        const price = s.price || svc?.basePrice || 0;

        return {
            type: "labour",
            description: svc ? svc.name : "Service",
            quantity: 1,
            unitPrice: price,
            discount: 0,
            total: price,
            isApproved: false,
        };
    });

    // Create the job card
    const jobCard = await JobCard.create({
        appointment: appointment._id,
        customer: appointment.customer?._id || appointment.customer,
        vehicle: appointment.vehicle?._id || appointment.vehicle,
        vehicleSnapshot: vehicle
            ? {
                vehicleNumber: vehicle.vehicleNumber,
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
            }
            : undefined,
        services: serviceIds,
        jobItems,
        customerComplaints: appointment.customerNotes
            ? [appointment.customerNotes]
            : [],
        status: "created",
        statusHistory: [
            {
                status: "created",
                changedAt: new Date(),
                notes: "Auto-created from appointment " + appointment.appointmentNumber,
            },
        ],
        notes: {
            internal: `Auto-created from appointment ${appointment.appointmentNumber}`,
        },
    });

    // Calculate billing totals
    jobCard.calculateBilling();
    await jobCard.save();

    // Link job card back to the appointment
    await Appointment.findByIdAndUpdate(appointment._id, {
        jobCard: jobCard._id,
    });

    return jobCard;
};

module.exports = {
    createJobCardFromAppointment,
};
