// server.js - Backend API only (no frontend serving)
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const app = express();

// CORS configuration - Allow your frontend domain
app.use(cors({
  origin: [
    "https://mymee.link",
    "https://www.mymee.link",
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL
  ].filter(Boolean), // Remove any undefined values
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// API Routes
const AuthRoutes = require("./routes/auth");
const LinkRoutes = require("./routes/links");
const UserRoutes = require("./routes/user");
const ThemeRoutes = require("./routes/theme");
const PublicRoutes = require("./routes/public");

app.use("/api/auth", AuthRoutes);
app.use("/api/links", LinkRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/theme", ThemeRoutes);
app.use("/api/public", PublicRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "Mymee.link API is running!",
    endpoints: {
      auth: "/api/auth",
      links: "/api/links",
      user: "/api/user",
      theme: "/api/theme",
      public: "/api/public"
    }
  });
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ 
    message: "Endpoint not found",
    path: req.path 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: "Something went wrong!", 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API available at: http://localhost:${PORT}/api`);
});