/**
 * Express Application Setup
 * Main application configuration
 */
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const config = require("./config");
const routes = require("./routes");
const {
  apiLimiter,
  errorConverter,
  mongoErrorHandler,
  errorHandler,
  notFoundHandler,
} = require("./middlewares");

// Create Express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check allowed origins
    if (config.cors.allowedOrigins === "*") {
      return callback(null, true);
    }

    const allowedOrigins = config.cors.allowedOrigins
      .split(",")
      .map((o) => o.trim());
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sanitize data against NoSQL injection
app.use(mongoSanitize());

// Request logging
if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting
app.use("/api", apiLimiter);

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to ClutchGear API",
    version: config.apiVersion,
    docs: `${config.apiBaseUrl}/docs`,
  });
});

// Handle 404
app.use(notFoundHandler);

// Error handlers
app.use(mongoErrorHandler);
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
