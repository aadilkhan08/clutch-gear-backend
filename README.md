# ClutchGear Backend API

Auto Service Workshop Management System - Backend API

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MongoDB Atlas account (or local MongoDB)
- ImageKit account (for image uploads)

### Installation

```bash
# Navigate to backend folder
cd clutch-gear-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your credentials
# (MongoDB URI, JWT secrets, ImageKit keys, etc.)

# Start development server
npm run dev

# Start production server
npm start
```

## 📁 Project Structure

```
clutch-gear-backend/
├── server.js              # Entry point
├── package.json           # Dependencies & scripts
├── .env.example           # Environment template
├── src/
│   ├── app.js             # Express app setup
│   ├── config/
│   │   ├── index.js       # Centralized config
│   │   └── db.js          # MongoDB connection
│   ├── controllers/       # Route handlers
│   ├── middlewares/       # Custom middlewares
│   ├── models/            # Mongoose schemas
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── validators/        # Request validators
```

## 🔐 Authentication

The API uses **OTP-based authentication** with JWT tokens.

### Flow:

1. User requests OTP → `POST /api/v1/auth/send-otp`
2. User verifies OTP → `POST /api/v1/auth/verify-otp`
3. User receives `accessToken` and `refreshToken`
4. Use `Authorization: Bearer <accessToken>` for protected routes
5. Refresh token when expired → `POST /api/v1/auth/refresh-token`

## 👥 Roles

| Role    | Description                                               |
| ------- | --------------------------------------------------------- |
| `user`  | Customer - Can book services, manage vehicles, track jobs |
| `admin` | Workshop Admin - Full access to all features              |

## 📡 API Endpoints

### Health Check

```
GET /api/v1/health
```

### Authentication

```
POST /api/v1/auth/send-otp        # Send OTP to mobile
POST /api/v1/auth/verify-otp      # Verify OTP & login
POST /api/v1/auth/resend-otp      # Resend OTP
POST /api/v1/auth/refresh-token   # Refresh access token
POST /api/v1/auth/logout          # Logout
GET  /api/v1/auth/me              # Get current user
```

### User Profile

```
GET  /api/v1/users/profile        # Get profile
PUT  /api/v1/users/profile        # Update profile
PUT  /api/v1/users/profile/image  # Update profile image
DELETE /api/v1/users/profile/image # Delete profile image
PUT  /api/v1/users/device         # Update device info (FCM token)
DELETE /api/v1/users/account      # Delete account
```

### Vehicles

```
GET    /api/v1/vehicles           # List user vehicles
POST   /api/v1/vehicles           # Add vehicle
GET    /api/v1/vehicles/:id       # Get vehicle
PUT    /api/v1/vehicles/:id       # Update vehicle
DELETE /api/v1/vehicles/:id       # Delete vehicle
POST   /api/v1/vehicles/:id/images # Upload vehicle images
DELETE /api/v1/vehicles/:id/images/:imageId # Delete image
```

### Services (Public)

```
GET /api/v1/services              # List all services
GET /api/v1/services/popular      # Popular services
GET /api/v1/services/categories/list # Service categories
GET /api/v1/services/category/:category # Services by category
GET /api/v1/services/:id          # Service details
```

### Appointments (User)

```
GET  /api/v1/appointments         # List appointments
GET  /api/v1/appointments/upcoming # Upcoming appointments
GET  /api/v1/appointments/slots   # Available time slots
POST /api/v1/appointments         # Book appointment
GET  /api/v1/appointments/:id     # Appointment details
PUT  /api/v1/appointments/:id/cancel # Cancel appointment
```

### Job Cards (User)

```
GET /api/v1/jobcards              # List job cards
GET /api/v1/jobcards/active       # Active job cards
GET /api/v1/jobcards/:id          # Job card details
GET /api/v1/jobcards/:id/history  # Status history
PUT /api/v1/jobcards/:id/approve  # Approve job items
```

### Payments (User)

```
GET /api/v1/payments              # Payment history
GET /api/v1/payments/:id          # Payment details
GET /api/v1/payments/jobcard/:id  # Job card payments
```

### Reviews

```
GET  /api/v1/reviews/public       # Public reviews
GET  /api/v1/reviews/stats        # Workshop stats
GET  /api/v1/reviews              # My reviews (auth)
POST /api/v1/reviews              # Create review (auth)
PUT  /api/v1/reviews/:id          # Update review (auth)
DELETE /api/v1/reviews/:id        # Delete review (auth)
```

### Upload

```
GET  /api/v1/upload/auth          # Get ImageKit auth params
POST /api/v1/upload/image         # Upload single image
POST /api/v1/upload/images        # Upload multiple images
DELETE /api/v1/upload/:fileId     # Delete image
```

### Admin Routes

All admin routes are prefixed with `/api/v1/admin`

```
# Dashboard
GET /admin/dashboard              # Dashboard stats

# Analytics
GET /admin/analytics/revenue      # Revenue analytics
GET /admin/analytics/services     # Service analytics

# User Management
GET    /admin/users               # List users
GET    /admin/users/:id           # User details
PUT    /admin/users/:id/status    # Update user status
POST   /admin/users/admin         # Create admin user

# Time Slots
GET    /admin/timeslots           # List time slots
POST   /admin/timeslots           # Create/update slot
DELETE /admin/timeslots/:id       # Delete slot

# Appointments
GET /admin/appointments           # All appointments
GET /admin/appointments/today     # Today's appointments
PUT /admin/appointments/:id       # Update appointment

# Job Cards
GET    /admin/jobcards            # All job cards
GET    /admin/jobcards/stats      # Job card stats
POST   /admin/jobcards            # Create job card
PUT    /admin/jobcards/:id        # Update job card
POST   /admin/jobcards/:id/items  # Add job item
DELETE /admin/jobcards/:id/items/:itemId # Remove item
PUT    /admin/jobcards/:id/billing # Update billing
POST   /admin/jobcards/:id/images # Upload images

# Payments
GET  /admin/payments              # All payments
GET  /admin/payments/summary      # Payment summary
GET  /admin/payments/today        # Today's collection
POST /admin/payments              # Record payment
PUT  /admin/payments/:id          # Update payment
POST /admin/payments/:id/refund   # Process refund

# Reviews
GET /admin/reviews                # All reviews
GET /admin/reviews/analytics      # Review analytics
PUT /admin/reviews/:id/respond    # Respond to review
PUT /admin/reviews/:id/visibility # Toggle visibility
```

## 📝 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": [ ... ],
  "meta": {
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "errors": [{ "field": "email", "message": "Invalid email format" }]
}
```

## 🔒 Security Features

- JWT Authentication
- Role-based access control
- Rate limiting
- Request sanitization (NoSQL injection prevention)
- Helmet security headers
- CORS configuration
- Input validation

## ⚡ Performance Optimizations

- MongoDB connection pooling
- Indexed database queries
- Pagination on all list endpoints
- Selective field projection
- Lean queries for read operations

## 🌐 Environment Variables

See `.env.example` for all configuration options.

Key variables:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing
- `IMAGEKIT_*` - ImageKit credentials
- `CORS_ALLOWED_ORIGINS` - Allowed origins (use \* for all)

## 📧 SMS Configuration

Currently supports:

- `console` - Development (logs to console)
- `twilio` - Twilio SMS
- `msg91` - MSG91 SMS

Set `SMS_PROVIDER` in `.env` to configure.

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📦 Scripts

```bash
npm start      # Start production server
npm run dev    # Start development server (nodemon)
npm test       # Run tests
npm run lint   # Lint code
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

ISC License

---

Built with ❤️ by ClutchGear Team
