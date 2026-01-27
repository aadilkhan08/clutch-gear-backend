const Razorpay = require("razorpay");
const crypto = require("crypto");

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

function getKeyId() {
  return process.env.RAZORPAY_KEY_ID;
}

/**
 * Create a Razorpay order
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} receipt - Unique receipt identifier
 * @param {object} notes - Additional metadata
 * @returns {Promise<object>} Razorpay order object
 */
async function createOrder(amount, receipt, notes = {}) {
  const razorpay = getRazorpayClient();

  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: "INR",
    receipt,
    notes,
  };

  return razorpay.orders.create(options);
}

/**
 * Verify payment signature from Razorpay
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} Whether the signature is valid
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    throw new Error("Razorpay key secret not configured");
  }

  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} Payment details
 */
async function fetchPayment(paymentId) {
  const razorpay = getRazorpayClient();
  return razorpay.payments.fetch(paymentId);
}

/**
 * Initiate refund for a payment
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Refund amount in INR (optional, full refund if not provided)
 * @param {object} notes - Additional metadata
 * @returns {Promise<object>} Refund object
 */
async function initiateRefund(paymentId, amount = null, notes = {}) {
  const razorpay = getRazorpayClient();

  const options = {
    notes,
  };

  if (amount) {
    options.amount = Math.round(amount * 100); // Convert to paise
  }

  return razorpay.payments.refund(paymentId, options);
}

module.exports = {
  getRazorpayClient,
  getKeyId,
  createOrder,
  verifyPaymentSignature,
  fetchPayment,
  initiateRefund,
};
