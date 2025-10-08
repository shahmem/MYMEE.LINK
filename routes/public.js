// routes/public.js - CREATE THIS NEW FILE
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Get public profile by username
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({ 
      username: username.toLowerCase(),
      isActive: true // Only show active profiles
    }).select("-password -email -auth_id"); // Exclude sensitive fields

    if (!user) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Filter only active links
    const activeLinks = user.links.filter(link => link.active !== false);
    const activeSocialLinks = user.socialLinks.filter(link => link.active !== false);

    // Return public profile data
    res.json({
      user: {
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio,
        header: user.header,
      },
      links: activeLinks.sort((a, b) => a.order - b.order),
      socialLinks: activeSocialLinks.sort((a, b) => a.socialorder - b.socialorder),
      theme: user.theme,
      position: user.socialPosition || 'top',
    });

  } catch (err) {
    console.error("Public profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;