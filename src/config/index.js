/**
 * Centralized Configuration Module
 * All environment variables are accessed from here
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const DEFAULT_FIREBASE_PLACEHOLDER = "/path/to/firebase-service-account.json";

function loadFirebaseServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.warn(
        "Invalid FIREBASE_SERVICE_ACCOUNT_JSON. Push notifications disabled."
      );
      return null;
    }
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) return null;

  // Guard against the placeholder from .env.example
  if (serviceAccountPath === DEFAULT_FIREBASE_PLACEHOLDER) {
    console.warn(
      "FIREBASE_SERVICE_ACCOUNT_PATH is set to the default placeholder. Push notifications disabled."
    );
    return null;
  }

  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(
      `Firebase service account file not found at '${resolvedPath}'. Push notifications disabled.`
    );
    return null;
  }

  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(resolvedPath);
  } catch (e) {
    console.warn(
      "Failed to load Firebase service account file. Push notifications disabled."
    );
    return null;
  }
}

const config = {
  // Server
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || "v1",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:5000/api/v1",

  // MongoDB
  mongodb: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/clutchgear",
    dbName: process.env.MONGODB_DB_NAME || "clutchgear",
    options: {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
    },
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },

  // OTP
  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 2,
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 3,
    resendCooldownSeconds:
      parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60,
    channel: process.env.OTP_CHANNEL || "sms",
  },

  // SMS
  sms: {
    provider: process.env.SMS_PROVIDER || "console",
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID || "CLUTCH",
  },

  // MSG91
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY,
    senderId: process.env.MSG91_SENDER_ID || process.env.SMS_SENDER_ID || "CLUTCH",
    otpTemplateId: process.env.MSG91_OTP_TEMPLATE_ID,
    whatsappOtpTemplateId: process.env.MSG91_WHATSAPP_OTP_TEMPLATE_ID,
    flowTemplateId: process.env.MSG91_FLOW_TEMPLATE_ID,
    webhookToken: process.env.MSG91_WEBHOOK_TOKEN,
  },

  // Fast2SMS
  fast2sms: {
    apiKey: process.env.FAST2SMS_API_KEY,
  },

  // ImageKit
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  },

  // Firebase Cloud Messaging
  firebase: {
    serviceAccount: loadFirebaseServiceAccount(),
  },

  // Garage/Business Info (for invoices)
  garage: {
    name: process.env.GARAGE_NAME || "ClutchGear Auto Services",
    address: process.env.GARAGE_ADDRESS || "",
    phone: process.env.GARAGE_PHONE || "",
    email: process.env.GARAGE_EMAIL || "",
    gst: process.env.GARAGE_GST || "",
    invoiceTerms: process.env.INVOICE_TERMS || "",
  },

  // CORS
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS || "*",
  },

  // Pagination
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE, 10) || 10,
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE, 10) || 100,
  },

  // Upload limits
  upload: {
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE, 10) || 100 * 1024 * 1024, // 100MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedVideoTypes: [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ],
  },
};

// Validate required configurations
const validateConfig = () => {
  const required = ["jwt.secret", "mongodb.uri"];
  const missing = [];

  required.forEach((key) => {
    const keys = key.split(".");
    let value = config;
    for (const k of keys) {
      value = value?.[k];
    }
    if (!value || value.includes("default")) {
      missing.push(key);
    }
  });

  if (missing.length > 0 && config.env === "production") {
    console.error(`Missing required config: ${missing.join(", ")}`);
    process.exit(1);
  }
};

validateConfig();

module.exports = config;
