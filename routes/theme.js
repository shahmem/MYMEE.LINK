const express = require("express");
const router = express.Router();
const multer = require("multer");
const User = require("../models/User");

const fs = require('fs');
const path = require('path');

// Multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });
// Helper function to delete file from filesystem
const deleteFileFromServer = (filePath) => {
  if (!filePath) return;
  
  const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
  const fullPath = path.join(__dirname, '..', cleanPath);
  
  if (fs.existsSync(fullPath)) {
    fs.unlink(fullPath, (err) => {
      if (err) {  
        console.error('Error deleting file:', err);
      } else {
        console.log('File deleted:', fullPath);
      }
    });
  }
};

// Built-in themes
const builtinThemes = {
  light: {
    bgColor: "#ef4444",
    nameColor: "#eeeeee",
    bioColor: "rgba(0,0,0,0.05)",
    iconColor: "#e5e7eb",
    iconBg: "#00000052",
    linkColor: "#ffffff",
    linkRadius: "24px",
    linkBg: "#00000052",
    headerColor: "#ffffff",
  },
  dark: {
    bgColor: "#777777",
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
    bg: "#aaaaaa",
    nameColor: "#111111",
    bioColor: "rgba(0,0,0,0.05)",
    iconColor: "#111111",
    iconBg: "rgba(0,0,0,0.2)",
    linkColor: "#111111",
    linkRadius: "0px",
    linkBg: "#00000052",
    headerColor: "#111111",
    linkBorderColor:"#333333",
  },
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

router.post(
  "/user/theme/custom/:userId",
  upload.single("themebg"),
  async (req, res) => {
    try {
      const {
        bgColor,
        bgType,
        nameColor,
        bioColor,
        iconColor,
        iconBg,
        linkColor,
        linkRadius,
        linkBg,
        headerColor,
        fontStyle,
        linkBorderColor,
      } = req.body;

      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Start with existing theme or default
      let updatedTheme = {
        name: "custom",
        bgType: bgType || user.theme?.bgType || "color",
        bgColor: bgColor || user.theme?.bgColor || "#ffffff",
        bgImage: user.theme?.bgImage || "",
        bgVideo: user.theme?.bgVideo || "",
        nameColor: nameColor || user.theme?.nameColor || "#000000",
        bioColor: bioColor || user.theme?.bioColor || "rgba(0,0,0,0.40)",
        iconColor: iconColor || user.theme?.iconColor || "#000000",
        iconBg: iconBg || user.theme?.iconBg || "#ffffff32",
        linkColor: linkColor || user.theme?.linkColor || "#000000",
        linkRadius: linkRadius || user.theme?.linkRadius || "24px",
        linkBg: linkBg || user.theme?.linkBg || "#ffffff72",
        linkBorderColor: linkBorderColor || user.theme?.linkBorderColor || "#ffffff72",
        headerColor: headerColor || user.theme?.headerColor || "#000000",
        fontStyle: fontStyle || user.theme?.fontStyle || "Inter, sans-serif",
      };

      // Handle file upload
      if (req.file) {
        const uploadPath = `/uploads/${req.file.filename}`;
        const fileType = req.file.mimetype.split('/')[0]; // 'image' or 'video'

        if (fileType === 'image') {
          updatedTheme.bgImage = uploadPath;
          updatedTheme.bgVideo = ""; // Clear video if image uploaded
          updatedTheme.bgType = "image";
        } else if (fileType === 'video') {
          updatedTheme.bgVideo = uploadPath;
          updatedTheme.bgImage = ""; // Clear image if video uploaded
          updatedTheme.bgType = "video";
        }
      }

      // Update user theme
      user.theme = updatedTheme;
      await user.save();

      res.json({ 
        message: "Custom theme updated", 
        theme: user.theme 
      });
    } catch (err) {
      console.error('Theme update error:', err);
      res.status(500).json({ message: err.message });
    }
  }
);
router.delete("/user/theme/background/:userId", async (req, res) => {
  try {
    const { bgImage, bgVideo } = req.body;
    const userId = req.params.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Delete files from server
    if (bgImage && user.theme.bgImage) {
      deleteFileFromServer(user.theme.bgImage);
    }
    if (bgVideo && user.theme.bgVideo) {
      deleteFileFromServer(user.theme.bgVideo);
    }

    // Update database
    user.theme.bgImage = '';
    user.theme.bgVideo = '';
    user.theme.bgType = 'color';
    await user.save();

    res.json({ 
      success: true, 
      message: "Background removed",
      theme: user.theme
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
});

module.exports = router;
