/**
 * MongoDB Database Connection
 * Features:
 * - Connection pooling
 * - Retry logic with exponential backoff
 * - Proper error handling
 * - Connection event listeners
 */
const mongoose = require("mongoose");
const config = require("./index");

let isConnected = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

/**
 * Connect to MongoDB with retry logic
 */
const connectDB = async () => {
  if (isConnected) {
    console.log("📦 Using existing MongoDB connection");
    return;
  }

  try {
    const conn = await mongoose.connect(config.mongodb.uri, {
      ...config.mongodb.options,
      dbName: config.mongodb.dbName,
    });

    isConnected = true;
    retryCount = 0;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);
      console.log(
        `🔄 Retrying connection (${retryCount}/${MAX_RETRIES}) in ${
          delay / 1000
        }s...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB();
    }

    console.error("💥 Max retries reached. Exiting...");
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("🔌 MongoDB Disconnected");
  } catch (error) {
    console.error(`❌ Error disconnecting: ${error.message}`);
  }
};

/**
 * Get connection status
 */
const getConnectionStatus = () => ({
  isConnected,
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host,
  name: mongoose.connection.name,
});

// Connection event listeners
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error(`🔴 Mongoose connection error: ${err.message}`);
  isConnected = false;
});

mongoose.connection.on("disconnected", () => {
  console.log("🟡 Mongoose disconnected from MongoDB");
  isConnected = false;
});

// Handle app termination
process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
};
