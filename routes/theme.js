const express = require("express");
const router = express.Router();
const multer = require("multer");
const User = require("../models/User");

// Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Built-in themes
const builtinThemes = {
  light: { /* ... */ },
  dark: { /* ... */ },
  pastel: { /* ... */ },
};

// ✅ Get all built-in themes
router.get("/builtin", (req, res) => {
  res.json(builtinThemes);
});

// ✅ Get user's theme
router.get("/user/:userId/theme", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.theme || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Apply built-in theme
router.post("/user/theme/builtin/:userId", async (req, res) => {
  try {
    const { themeName } = req.body;
    const theme = builtinThemes[themeName];
    if (!theme) return res.status(400).json({ message: "Theme not found" });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.theme = theme;
    await user.save();
    res.json({ message: "Theme applied", theme });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Apply custom theme
router.post("/user/theme/custom/:userId", upload.single("themebg"), async (req, res) => {
  try {
    const {
      bgColor, bgVideo, nameColor, bioColor,
      iconColor, iconBg, linkColor, linkRadius,
      linkBg, headerColor, fontStyle
    } = req.body;

    const bgImage = req.file ? `/uploads/${req.file.filename}` : "";

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.theme = {
      name: "custom",
      bgColor, bgImage, bgVideo, nameColor,
      bioColor, iconColor, iconBg, linkColor,
      linkRadius, linkBg, headerColor, fontStyle
    };

    await user.save();
    res.json({ message: "Custom theme updated", theme: user.theme });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
