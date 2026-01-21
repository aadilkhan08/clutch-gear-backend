/**
 * Bootstrap Super Admin
 *
 * Creates or promotes a user to `superadmin` using a real mobile number.
 * This does NOT create any demo/sample domain data.
 *
 * Usage:
 *   BOOTSTRAP_SUPERADMIN_MOBILE=9XXXXXXXXX node src/scripts/bootstrapSuperAdmin.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const config = require("../config");
const User = require("../models/user.model");

const mobile = process.env.BOOTSTRAP_SUPERADMIN_MOBILE;
const name = process.env.BOOTSTRAP_SUPERADMIN_NAME || "Super Admin";
const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;

async function run() {
  if (!mobile) {
    console.error(
      "Missing BOOTSTRAP_SUPERADMIN_MOBILE. Example: BOOTSTRAP_SUPERADMIN_MOBILE=9876543210"
    );
    process.exit(1);
  }

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    console.error("Invalid mobile format. Expected 10-digit Indian number.");
    process.exit(1);
  }

  await mongoose.connect(config.mongodb.uri, {
    dbName: config.mongodb.dbName,
  });

  try {
    let user = await User.findOne({ mobile });

    if (!user) {
      user = await User.create({
        mobile,
        name,
        email,
        role: "superadmin",
        isActive: true,
        isVerified: false,
      });
      console.log(`✅ Created superadmin user for mobile: ${mobile}`);
    } else {
      user.role = "superadmin";
      user.isActive = true;
      if (email && !user.email) user.email = email;
      if (name && (!user.name || user.name.trim().length === 0))
        user.name = name;
      await user.save();
      console.log(`✅ Promoted existing user to superadmin: ${mobile}`);
    }

    console.log(
      "Next: login via OTP using this mobile; the role will be enforced server-side."
    );
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});
