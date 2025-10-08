// server.js - ADD THIS TO YOUR EXISTING SERVER.JS
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Import routes
const AuthRoutes = require("./routes/auth");
const LinkRoutes = require("./routes/links");
const UserRoutes = require("./routes/user");
const ThemeRoutes = require("./routes/theme");
const PublicRoutes = require("./routes/public"); // ADD THIS

// API Routes
app.use("/api/auth", AuthRoutes);
app.use("/api", LinkRoutes);
app.use("/api", UserRoutes);
app.use("/api", ThemeRoutes);
app.use("/api/public", PublicRoutes); // ADD THIS - Public profile routes

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Mymee.link API is running!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});