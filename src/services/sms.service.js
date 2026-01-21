/**
 * SMS Service
 * Handles sending SMS messages (OTP, notifications)
 */
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

      case "twilio":
        return await sendTwilioSMS(mobile, message);

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
 * Send SMS via Twilio
 */
const sendTwilioSMS = async (mobile, message) => {
  // Twilio implementation
  // const twilio = require('twilio');
  // const client = twilio(config.sms.accountSid, config.sms.authToken);
  // await client.messages.create({
  //   body: message,
  //   from: config.sms.phoneNumber,
  //   to: mobile,
  // });
  console.log("📱 Twilio SMS:", { to: mobile, message });
  return { success: true, provider: "twilio" };
};

/**
 * Send SMS via MSG91
 */
const sendMsg91SMS = async (mobile, message) => {
  // MSG91 implementation
  // const axios = require('axios');
  // await axios.post('https://api.msg91.com/api/v5/flow/', {
  //   template_id: config.sms.templateId,
  //   mobile,
  //   ...
  // });
  console.log("📱 MSG91 SMS:", { to: mobile, message });
  return { success: true, provider: "msg91" };
};

/**
 * Send OTP SMS
 */
const sendOTP = async (mobile, otp) => {
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
