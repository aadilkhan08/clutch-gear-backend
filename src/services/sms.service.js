/**
 * SMS Service
 * Handles sending SMS messages (OTP, notifications)
 */
const axios = require("axios");
const config = require("../config");

/**
 * Send SMS using configured provider
 */
const sendSMS = async (mobile, message) => {
  const provider = config.sms.provider;

  try {
    switch (provider) {
      case "console":
        // Development - just log to console
        console.log("📱 SMS (Console):", {
          to: mobile,
          message,
        });
        return { success: true, provider: "console" };

      case "msg91":
        return await sendMsg91SMS(mobile, message);

      default:
        console.log("📱 SMS (Default):", { to: mobile, message });
        return { success: true, provider: "default" };
    }
  } catch (error) {
    console.error("SMS Error:", error);
    throw new Error("Failed to send SMS");
  }
};

/**
 * Send SMS via MSG91
 */
const sendMsg91SMS = async (mobile, message) => {
  const { authKey, flowTemplateId } = config.msg91;
  if (!authKey || !flowTemplateId) {
    throw new Error("MSG91 auth key or flow template ID not configured");
  }

  const payload = {
    template_id: flowTemplateId,
    short_url: "0",
    recipients: [
      {
        mobiles: mobile.replace(/\D/g, ""),
        message,
      },
    ],
  };

  const response = await axios.post(
    "https://api.msg91.com/api/v5/flow/",
    payload,
    {
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }
  );

  return {
    success: true,
    provider: "msg91",
    response: response.data,
  };
};

/**
 * Send OTP via MSG91 (using Send OTP API)
 */
const sendMsg91OTP = async (mobile, otp, options = {}) => {
  const { authKey, otpTemplateId, whatsappOtpTemplateId } = config.msg91;
  const channel = options.channel || "sms";
  const templateId =
    options.templateId ||
    (channel === "whatsapp" ? whatsappOtpTemplateId : otpTemplateId);

  if (!authKey || !templateId) {
    throw new Error("MSG91 auth key or OTP template ID not configured");
  }

  // Format mobile number - MSG91 expects country code + number (e.g., 918720809245)
  let formattedMobile = mobile.replace(/\D/g, "");
  // Add 91 prefix if not present (for Indian numbers)
  if (!formattedMobile.startsWith("91") && formattedMobile.length === 10) {
    formattedMobile = "91" + formattedMobile;
  }

  console.log("📱 MSG91 OTP Request:", {
    mobile: formattedMobile,
    otp,
    templateId,
    channel,
  });

  try {
    // Use MSG91 Send OTP API
    const query = new URLSearchParams({
      template_id: templateId,
      mobile: formattedMobile,
      otp: String(otp),
    });

    if (config.otp.expiryMinutes) {
      query.set("otp_expiry", String(config.otp.expiryMinutes));
    }

    if (channel && channel !== "sms") {
      query.set("channel", channel);
    }

    const response = await axios.post(
      `https://control.msg91.com/api/v5/otp?${query.toString()}`,
      {},
      {
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ MSG91 OTP Response:", response.data);

    return {
      success: true,
      provider: "msg91",
      response: response.data,
    };
  } catch (error) {
    console.error("❌ MSG91 OTP Error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    throw error;
  }
};

/**
 * Send OTP SMS
 */
const sendOTP = async (mobile, otp) => {
  const provider = config.sms.provider;
  const channel = config.otp.channel;

  if (provider === "msg91" || provider === "msg91-whatsapp") {
    const resolvedChannel =
      provider === "msg91-whatsapp" ? "whatsapp" : channel || "sms";
    return await sendMsg91OTP(mobile, otp, { channel: resolvedChannel });
  }

  const message = `Your ClutchGear OTP is ${otp}. Valid for ${config.otp.expiryMinutes} minutes. Do not share with anyone.`;
  return await sendSMS(mobile, message);
};

/**
 * Send appointment confirmation SMS
 */
const sendAppointmentConfirmation = async (mobile, appointmentDetails) => {
  const { appointmentNumber, date, time, vehicleNumber } = appointmentDetails;
  const message = `Your appointment ${appointmentNumber} is confirmed for ${date} at ${time} for vehicle ${vehicleNumber}. - ClutchGear`;
  return await sendSMS(mobile, message);
};

/**
 * Send job status update SMS
 */
const sendJobStatusUpdate = async (mobile, jobDetails) => {
  const { jobNumber, status, vehicleNumber } = jobDetails;
  const message = `Your vehicle ${vehicleNumber} (Job: ${jobNumber}) status: ${status}. Track on ClutchGear app.`;
  return await sendSMS(mobile, message);
};

module.exports = {
  sendSMS,
  sendOTP,
  sendAppointmentConfirmation,
  sendJobStatusUpdate,
};
