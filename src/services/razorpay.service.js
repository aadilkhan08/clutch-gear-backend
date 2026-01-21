const Razorpay = require("razorpay");

let client;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const err = new Error("Razorpay is not configured");
    err.code = "RAZORPAY_NOT_CONFIGURED";
    throw err;
  }

  if (!client) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return client;
}

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

module.exports = {
  getRazorpayClient,
  getRazorpayKeyId,
};
