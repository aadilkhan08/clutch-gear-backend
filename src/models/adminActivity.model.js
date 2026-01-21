/**
 * Admin Activity Model
 * Tracks admin privilege changes and actions
 */
const mongoose = require("mongoose");

const adminActivitySchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Super Admin performing action
    action: {
      type: String,
      enum: ["promote-admin", "revoke-admin"],
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    metadata: { type: Object },
  },
  { timestamps: true }
);

const AdminActivity = mongoose.model("AdminActivity", adminActivitySchema);

module.exports = AdminActivity;
