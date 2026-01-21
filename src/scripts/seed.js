/**
 * Seed Script (DISABLED)
 *
 * This repository enforces a strict no-dummy-data policy.
 * Any scripts that generate demo/sample records are intentionally disabled.
 */

console.error(
  "Seeding is disabled. This project does not allow dummy/sample data."
);
process.exit(1);
    displayOrder: 5,
  },
  {
    name: "Starter Motor Repair",
    category: "repair",
    description: "Starter motor testing and repair/replacement",
    basePrice: 3000,
    estimatedDuration: { value: 90, unit: "minutes" },
    displayOrder: 6,
  },
  {
    name: "Alternator Repair",
    category: "repair",
    description: "Alternator testing and repair/replacement",
    basePrice: 3500,
    estimatedDuration: { value: 2, unit: "hours" },
    displayOrder: 7,
  },

  // Maintenance Services
  {
    name: "Coolant Flush",
    category: "maintenance",
    description: "Complete cooling system flush and coolant replacement",
    basePrice: 1200,
    estimatedDuration: { value: 1, unit: "hours" },
    displayOrder: 1,
  },
  {
    name: "Brake Fluid Change",
    category: "maintenance",
    description: "Complete brake fluid flush and replacement",
    basePrice: 800,
    estimatedDuration: { value: 30, unit: "minutes" },
    displayOrder: 2,
  },
  {
    name: "Automatic Transmission Service",
    category: "maintenance",
    description: "ATF fluid change and filter replacement",
    basePrice: 4500,
    estimatedDuration: { value: 90, unit: "minutes" },
    displayOrder: 3,
  },
  {
    name: "Bush Replacement",
    category: "maintenance",
    description: "Suspension bush replacement",
    basePrice: 1500,
    estimatedDuration: { value: 1, unit: "hours" },
    displayOrder: 4,
  },

  // Inspection Services
  {
    name: "Engine Diagnostic",
    category: "inspection",
    description: "Computer-based engine diagnostic to identify issues",
    basePrice: 800,
    estimatedDuration: { value: 45, unit: "minutes" },
    displayOrder: 1,
  },
  {
    name: "Brake Inspection",
    category: "inspection",
    description: "Complete brake system inspection and report",
    basePrice: 500,
    estimatedDuration: { value: 30, unit: "minutes" },
    displayOrder: 2,
  },
  {
    name: "Suspension Inspection",
    category: "inspection",
    description: "Complete suspension system inspection",
    basePrice: 500,
    estimatedDuration: { value: 30, unit: "minutes" },
    displayOrder: 3,
  },
  {
    name: "Pre-Purchase Inspection",
    category: "inspection",
    description: "Complete inspection for used car purchase",
    basePrice: 1500,
    estimatedDuration: { value: 90, unit: "minutes" },
    displayOrder: 4,
  },

  // Electrical Services
  {
    name: "Battery Replacement",
    category: "electrical",
    description: "Car battery replacement with quality battery",
    basePrice: 5500,
    estimatedDuration: { value: 30, unit: "minutes" },
    image: { url: "https://ik.imagekit.io/clutchgear/services/battery.jpg" },
    isPopular: true,
    displayOrder: 1,
  },
  {
    name: "Electrical Diagnosis",
    category: "electrical",
    description: "Complete electrical system diagnosis",
    basePrice: 1000,
    estimatedDuration: { value: 1, unit: "hours" },
    displayOrder: 2,
  },

  // AC Services
  {
    name: "AC Service",
    category: "ac-service",
    description: "Complete AC service with gas top-up and filter cleaning",
    basePrice: 2500,
    estimatedDuration: { value: 90, unit: "minutes" },
    image: { url: "https://ik.imagekit.io/clutchgear/services/ac-service.jpg" },
    isPopular: true,
    displayOrder: 1,
  },
  {
    name: "AC Gas Refill",
    category: "ac-service",
    description: "AC gas refill (R134a)",
    basePrice: 1500,
    estimatedDuration: { value: 45, unit: "minutes" },
    displayOrder: 2,
  },
  {
    name: "AC Compressor Repair",
    category: "ac-service",
    description: "AC compressor repair/replacement",
    basePrice: 8000,
    estimatedDuration: { value: 3, unit: "hours" },
    displayOrder: 3,
  },

  // Tyre Services
  {
    name: "Tyre Replacement",
    category: "tyre-service",
    description: "Single tyre replacement (price excluding tyre cost)",
    basePrice: 300,
    estimatedDuration: { value: 20, unit: "minutes" },
    displayOrder: 1,
  },
  {
    name: "Wheel Alignment",
    category: "tyre-service",
    description: "4-wheel computerized alignment",
    basePrice: 1200,
    estimatedDuration: { value: 45, unit: "minutes" },
    image: { url: "https://ik.imagekit.io/clutchgear/services/alignment.jpg" },
    isPopular: true,
    displayOrder: 2,
  },
  {
    name: "Wheel Balancing",
    category: "tyre-service",
    description: "4-wheel balancing",
    basePrice: 600,
    estimatedDuration: { value: 30, unit: "minutes" },
    displayOrder: 3,
  },
  {
    name: "Puncture Repair",
    category: "tyre-service",
    description: "Tubeless tyre puncture repair",
    basePrice: 200,
    estimatedDuration: { value: 15, unit: "minutes" },
    displayOrder: 4,
  },

  // Bodywork Services
  {
    name: "Dent Repair",
    category: "bodywork",
    description: "Minor dent repair (per panel)",
    basePrice: 2000,
    estimatedDuration: { value: 2, unit: "hours" },
    displayOrder: 1,
  },
  {
    name: "Full Body Paint",
    category: "bodywork",
    description: "Complete car repainting",
    basePrice: 35000,
    estimatedDuration: { value: 2, unit: "days" },
    displayOrder: 2,
  },
  {
    name: "Scratch Repair",
    category: "bodywork",
    description: "Scratch repair and touch-up",
    basePrice: 1500,
    estimatedDuration: { value: 1, unit: "hours" },
    displayOrder: 3,
  },

  // Washing Services
  {
    name: "Basic Wash",
    category: "washing",
    description: "Exterior wash and interior vacuum",
    basePrice: 300,
    estimatedDuration: { value: 30, unit: "minutes" },
    displayOrder: 1,
  },
  {
    name: "Full Detailing",
    category: "washing",
    description: "Complete interior and exterior detailing with polish",
    basePrice: 2500,
    estimatedDuration: { value: 3, unit: "hours" },
    isPopular: true,
    displayOrder: 2,
  },
];

// Time slots for each day of the week (Monday-Saturday, 0=Sunday)
const generateTimeSlots = () => {
  const slots = [];
  const slotTimes = [
    { startTime: "09:00", endTime: "10:00", maxBookings: 3 },
    { startTime: "10:00", endTime: "11:00", maxBookings: 3 },
    { startTime: "11:00", endTime: "12:00", maxBookings: 3 },
    { startTime: "12:00", endTime: "13:00", maxBookings: 2 },
    { startTime: "13:00", endTime: "14:00", maxBookings: 2 },
    { startTime: "14:00", endTime: "15:00", maxBookings: 3 },
    { startTime: "15:00", endTime: "16:00", maxBookings: 3 },
    { startTime: "16:00", endTime: "17:00", maxBookings: 3 },
    { startTime: "17:00", endTime: "18:00", maxBookings: 3 },
    { startTime: "18:00", endTime: "19:00", maxBookings: 2 },
  ];

  // Monday to Saturday (1-6)
  for (let day = 1; day <= 6; day++) {
    for (const slot of slotTimes) {
      slots.push({
        dayOfWeek: day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxBookings: slot.maxBookings,
        isActive: true,
      });
    }
  }

  return slots;
};

const timeSlots = generateTimeSlots();

async function seed() {
  try {
    console.log("🌱 Starting database seeding...\n");

    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    console.log("✅ Connected to MongoDB\n");

    // Seed Services
    console.log("📦 Seeding services...");
    const existingServices = await Service.countDocuments();
    if (existingServices === 0) {
      await Service.insertMany(services);
      console.log(`   ✅ Created ${services.length} services\n`);
    } else {
      console.log(
        `   ⏭️  Skipped - ${existingServices} services already exist\n`
      );
    }

    // Seed Time Slots
    console.log("⏰ Seeding time slots...");
    const existingSlots = await TimeSlot.countDocuments();
    if (existingSlots === 0) {
      await TimeSlot.insertMany(timeSlots);
      console.log(`   ✅ Created ${timeSlots.length} time slots\n`);
    } else {
      console.log(
        `   ⏭️  Skipped - ${existingSlots} time slots already exist\n`
      );
    }

    // Create admin user if not exists
    console.log("👤 Checking admin user...");
    const existingAdmin = await User.findOne({ role: "admin" });
    if (!existingAdmin) {
      const adminUser = await User.create({
        mobile: "9999999999", // Change this to actual admin mobile
        name: "Admin",
        email: "admin@clutchgear.com",
        role: "admin",
        isVerified: true,
        status: "active",
      });
      console.log(`   ✅ Created admin user: ${adminUser.mobile}\n`);
    } else {
      console.log(
        `   ⏭️  Skipped - Admin user already exists: ${existingAdmin.mobile}\n`
      );
    }

    console.log("✨ Seeding completed successfully!\n");

    // Print summary
    console.log("📊 Database Summary:");
    console.log(`   Services: ${await Service.countDocuments()}`);
    console.log(`   Time Slots: ${await TimeSlot.countDocuments()}`);
    console.log(`   Users: ${await User.countDocuments()}`);
    console.log("");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run seed
seed();
