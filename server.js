/**
 * ClutchGear Backend Server
 * Entry point for the application
 */
const app = require("./src/app");
const config = require("./src/config");
const { connectDB, getConnectionStatus } = require("./src/config/db");
const subscriptionService = require("./src/services/subscription.service");
const serviceScheduleService = require("./src/services/serviceSchedule.service");
const notificationScheduler = require("./src/services/notificationScheduler.service");

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();

    // Initialize subscription cron jobs
    subscriptionService.initCronJobs();
    // Initialize service schedule cron jobs
    serviceScheduleService.initCronJobs();
    // Initialize notification scheduler cron jobs
    notificationScheduler.initializeScheduler();

    // Start Express server
    const server = app.listen(config.port, () => {
      console.log("=".repeat(50));
      console.log(`🚀 ClutchGear API Server Started!`);
      console.log("=".repeat(50));
      console.log(`📍 Environment: ${config.env}`);
      console.log(`🌐 Server URL: http://localhost:${config.port}`);
      console.log(`📡 API Base: ${config.apiBaseUrl}`);
      console.log(
        `🏥 Health Check: http://localhost:${config.port}/api/${config.apiVersion}/health`
      );
      console.log("=".repeat(50));
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (err) => {
      console.error("💥 UNHANDLED REJECTION! Shutting down...");
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.log("👋 SIGTERM received. Shutting down gracefully...");
      server.close(() => {
        console.log("💤 Process terminated.");
      });
    });

    process.on("SIGINT", () => {
      console.log("👋 SIGINT received. Shutting down gracefully...");
      server.close(() => {
        console.log("💤 Process terminated.");
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// Run server
startServer();
