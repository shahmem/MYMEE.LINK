// routes/public.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Get public profile by username
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Find user by username using the static method
    const user = await User.findByUsername(username);

    if (!user || !user.isActive || !user.isPublic) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Update analytics (optional)
    user.analytics.totalViews = (user.analytics.totalViews || 0) + 1;
    user.analytics.lastVisit = new Date();
    await user.save();

    // Get public profile data using the instance method
    const publicProfile = user.getPublicProfile();

    // Return public profile data
    res.json({
      user: {
        name: publicProfile.name,
        username: publicProfile.username,
        profileImage: publicProfile.profileImage,
        bio: publicProfile.bio,
        header: publicProfile.header,
      },
      links: publicProfile.links,
      socialLinks: publicProfile.socialLinks,
      theme: publicProfile.theme,
      position: publicProfile.socialPosition,
    });

  } catch (err) {
    console.error("Public profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;