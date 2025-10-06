const express = require("express");
const router = express.Router();
const multer = require("multer");
const User = require("../models/User");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Built-in read-only themes
const builtinThemes = {
  light: {
    name: "light",
    bgColor: "",
    bgImage: "https://cdn.bio.link/themes/backgrounds/rainy_night.jpg",
    bgVideo: "",
    nameColor: "#ffffff",
    bioColor: "rgba(0,0,0,0.05)",
    iconColor: "#e5e7eb",
    iconBg: "#00000052",
    linkColor: "#ffffff",
    linkRadius: "24px",
    linkBg: "#00000052",
    headerColor: "#ffff66",
  },
  dark: {
    name: "dark",
    bgColor: "#1f4444",
    bgImage: "",
    bgVideo: "",
    nameColor: "#111111",
    bioColor: "rgba(0,0,0,0.05)",
    iconColor: "#111111",
    iconBg: "rgba(0,0,0,0.2)",
    linkColor: "#111111",
    linkRadius: "6px",
    linkBg: "#00000052",
    headerColor: "#111111",
  },
  pastel: {
    name: "pastel",
    bgColor: "#aaaaaa",
    bgImage: "",
    bgVideo: "",
    nameColor: "#111111",
    bioColor: "rgba(0,0,0,0.05)",
    iconColor: "#111111",
    iconBg: "rgba(0,0,0,0.2)",
    linkColor: "#111111",
    linkRadius: "0px",
    linkBg: "#00000052",
    headerColor: "#111111",
  },
};

// ==========================
// GET all built-in themes
// ==========================
router.get("/builtin", (req, res) => {
  res.json(builtinThemes);
});

// ==========================
// GET user's current theme
// ==========================
router.get("/user/:userId/theme", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Return user's theme or default custom theme
    const defaultTheme = {
      name: "custom",
      bgColor: "#ffffff",
      bgImage: "",
      bgVideo: "",
      nameColor: "#000000",
      bioColor: "rgba(0,0,0,0.40)",
      iconColor: "#ffffff",
      iconBg: "#00000032",
      linkColor: "#ffffff",
      linkRadius: "24px",
      linkBg: "#00000072",
      headerColor: "#000000",
      fontStyle: "Arial, sans-serif",
    };

    res.json(user.theme || defaultTheme);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ==========================
// Set built-in theme for user
// ==========================
router.post("/user/theme/builtin/:userId", async (req, res) => {
  try {
    const { userId, themeName } = req.body;

    if (!builtinThemes[themeName])
      return res.status(400).json({ message: "Theme not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.theme = { ...builtinThemes[themeName] }; // assign built-in theme
    await user.save();

    res.json({ message: `Theme '${themeName}' applied`, theme: user.theme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ==========================
// Set or update custom theme instantly
// ==========================
router.post("/user/theme/custom/:userId", upload.single("themebg"), async (req, res) => {
  try {
    const {
      name,
      bgColor,
      bgVideo,
      nameColor,
      bioColor,
      iconColor,
      iconBg,
      linkColor,
      linkRadius,
      linkBg,
      headerColor,
      fontStyle,
    } = req.body;

    const bgImage = req.file ? `/uploads/${req.file.filename}` : "";

    const customTheme = {
      name: name || "custom",
      bgColor,
      bgImage,
      bgVideo,
      nameColor,
      bioColor,
      iconColor,
      iconBg,
      linkColor,
      linkRadius,
      linkBg,
      headerColor,
      fontStyle,
    };

    const user = await User.findById(req.params.userId); // <--- use params
    if (!user) return res.status(404).json({ message: "User not found" });

    user.theme = customTheme;
    await user.save();

    res.json({ message: "Custom theme updated", theme: user.theme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


module.exports = router;
