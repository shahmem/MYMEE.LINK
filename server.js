// server.js - Updated with SPA support
const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// API Routes - All API routes should be prefixed with /api
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

// Serve static files from React build
app.use(express.static(path.join(__dirname, "client/dist"))); // or "client/build" if using create-react-app

// Catch-all route - MUST be after all API routes
// Use regex pattern instead of wildcard for compatibility
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "client/dist", "index.html")); // or "client/build" if using CRA
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