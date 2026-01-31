/**
 * Webhook Controller
 * Handles external provider webhooks
 */
const config = require("../config");
const { ApiResponse, ApiError, asyncHandler } = require("../utils");

/**
 * @desc    MSG91 webhook (Events & Actions)
 * @route   POST /api/v1/webhooks/msg91/events
 * @access  Public (secured via token header/query if configured)
 */
const handleMsg91Events = asyncHandler(async (req, res) => {
    const token = req.headers["x-msg91-token"] || req.query.token;

    if (config.msg91.webhookToken && token !== config.msg91.webhookToken) {
        throw ApiError.unauthorized("Invalid webhook token");
    }

    // Log payload for auditing/debugging. Customize as needed.
    console.log("[MSG91 Webhook] Events payload:", req.body);

    return ApiResponse.success(res, "Webhook received", {
        received: true,
    });
});

module.exports = {
    handleMsg91Events,
};
