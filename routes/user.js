const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const User = require("../models/User");
const {
  GetUser,
  AddHeader, 
  DeleteHeader,
  UpdateProfile,
  updateUsername,
} = require("../controllers/userController");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + path.extname(file.originalname)),
});
const upload = multer({ storage });

// User routes
// router.get("/user", GetUser);
router.put("/user/:userId/username", updateUsername);
router.get("/user/:userId", GetUser);
router.put("/user/:userId/header", AddHeader);
router.put("/profile/:id", upload.single("img"), UpdateProfile);
router.delete("/user/:userId/header/delete", DeleteHeader);

// routes/users.js or wherever your routes are

const bcrypt = require("bcrypt");

// Verify current password route
router.post("/user/:userId/verify-password", async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(userId);
    
    const { currentPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid)
      return res.status(401).json({ success: false, message: "Incorrect password" });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", success: false });
  }
});

// PUT /api/users/:userId/change-password
router.put("/user/:userId/change-password", async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedPassword;
    user.updatedAt = Date.now();
    await user.save();
    
    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

module.exports = router;
