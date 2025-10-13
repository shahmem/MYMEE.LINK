// controllers/userController.js
const User = require("../models/User");
const fs = require("fs");
const path = require("path");

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

const GetUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = userId ? await User.findById(userId) : await User.findOne();

    if (!user) return res.status(404).json({ message: "User not found" });

    const theme =
      user.theme && Object.keys(user.theme).length > 0
        ? user.theme
        : defaultTheme;

    res.json({ ...user.toObject(), theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const UpdateProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, bio } = req.body;
    const updateData = { name, bio };

    if (req.file) {
      updateData.profileImage = `${req.file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: "Profile updated", user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
const updateUsername = async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, urlFormat } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({
        message: "Username must be at least 3 characters",
      });
    }

    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({
        message:
          "Username can only contain lowercase letters, numbers, and underscores",
      });
    }

    // Validate URL format
    if (urlFormat && !["subdomain", "path"].includes(urlFormat)) {
      return res.status(400).json({
        message: "Invalid URL format",
      });
    }

    // Check if username already exists (excluding current user)
    const existingUser = await User.findOne({
      username: username.toLowerCase(),
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Username already taken",
      });
    }

    // Update username and URL format
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.username = username.toLowerCase();
    if (urlFormat) {
      user.urlFormat = urlFormat;
    }
    await user.save();

    res.json({
      message: "Settings updated successfully",
      username: user.username,
      urlFormat: user.urlFormat,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ========== REGULAR LINKS ==========

const AddLinks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, url } = req.body;
    const icon = req.file ? req.file.filename : null;

    if (!title || !url)
      return res.status(400).json({ error: "Title and URL required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const nextOrder =
      user.links.length > 0
        ? Math.max(...user.links.map((link) => link.order)) + 1
        : 0;

    // ✅ Schema's `set()` will handle adding https:// if missing
    user.links.push({ title, url, icon, order: nextOrder });
    await user.save();

    res.status(201).json(user.links.sort((a, b) => a.order - b.order));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const GetLinks = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const sortedLinks = user.links.sort((a, b) => a.order - b.order);
    res.json(sortedLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const ReorderLink = async (req, res) => {
  const { userId } = req.params;
  const { links } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    links.forEach(({ id, order }) => {
      const linkDoc = user.links.find((link) => link._id.toString() === id);
      if (linkDoc) linkDoc.order = order;
    });

    await user.save();

    const sortedLinks = user.links.sort((a, b) => a.order - b.order);
    res.json({ success: true, links: sortedLinks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
};

const editLink = async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, url, linkId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const link = user.links.id(linkId);
    if (!link) return res.status(404).json({ message: "Link not found" });

    if (title) link.title = title;
    if (url) link.url = url;

    if (req.file) {
      if (link.icon) {
        const oldPath = path.join("uploads", link.icon);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      link.icon = req.file.filename;
    }

    await user.save();
    res.json({ message: "Link updated", link });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const DeleteLink = async (req, res) => {
  try {
    const { userId } = req.params;
    const { linkId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const link = user.links.id(linkId);
    if (!link) return res.status(404).json({ message: "Link not found" });

    if (link.icon) {
      const iconPath = path.join("uploads", link.icon);
      fs.existsSync(iconPath) && fs.unlinkSync(iconPath);
    }

    user.links.pull({ _id: linkId });
    await user.save();

    res.json({ message: "Link deleted", id: linkId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ========== SOCIAL LINKS ==========

const AddSocialLink = async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, url, icon } = req.body;

    if (!title || !url || !icon) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Calculate next order
    const nextSocialOrder =
      user.socialLinks.length > 0
        ? Math.max(...user.socialLinks.map((l) => l.socialorder)) + 1
        : 0;

    // Create new social link (title and icon will auto-convert to lowercase)
    const newLink = {
      title: title.toLowerCase(),
      url,
      icon: icon.toLowerCase(),
      socialorder: nextSocialOrder,
      active: true,
    };

    user.socialLinks.push(newLink);
    await user.save();

    res.status(201).json(user.socialLinks[user.socialLinks.length - 1]);
  } catch (error) {
    console.error(error);

    // Handle validation errors (enum mismatch)
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid social platform",
        error: error.message,
      });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const GetSocialLinks = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const sortedLinks = user.socialLinks.sort(
      (a, b) => a.socialorder - b.socialorder
    );
    res.json(sortedLinks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const ReorderSocialLinks = async (req, res) => {
  const { userId } = req.params;
  const { links } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    links.forEach(({ _id, order }) => {
      const linkDoc = user.socialLinks.find(
        (link) => link._id.toString() === _id
      );
      if (linkDoc) linkDoc.socialorder = order;
    });

    await user.save();

    const sortedLinks = user.socialLinks.sort(
      (a, b) => a.socialorder - b.socialorder
    );
    res.json({ success: true, links: sortedLinks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reorder social links" });
  }
};

const UpdateSocialLink = async (req, res) => {
  try {
    const { userId } = req.params;
    const { id, url } = req.body;

    if (!id || !url) {
      return res.status(400).json({ error: "id and url are required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const link = user.socialLinks.id(id);
    if (!link) return res.status(404).json({ error: "Social link not found" });

    link.url = url;
    await user.save();

    res.json({ success: true, link });
  } catch (err) {
    console.error("UpdateSocialLink error:", err);
    res.status(500).json({ error: "Failed to update social link" });
  }
};

const DeleteSocialLink = async (req, res) => {
  try {
    const { userId } = req.params;
    const { linkId } = req.body;

    if (!linkId) {
      return res.status(400).json({ error: "linkId is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.socialLinks = user.socialLinks.filter(
      (link) => link._id.toString() !== linkId
    );
    await user.save();

    const sortedLinks = user.socialLinks.sort(
      (a, b) => a.socialorder - b.socialorder
    );
    res.json({ success: true, links: sortedLinks });
  } catch (err) {
    console.error("DeleteSocialLink error:", err);
    res.status(500).json({ error: "Failed to delete social link" });
  }
};

// ========== HEADER ==========

const AddHeader = async (req, res) => {
  try {
    const { userId } = req.params;
    const { header } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.header = header;
    await user.save();

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update header" });
  }
};

const DeleteHeader = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.header = "";
    await user.save();

    res.json({ success: true, header: "" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete header" });
  }
};

module.exports = {
  GetUser,
  UpdateProfile,
  AddLinks,
  GetLinks,
  ReorderLink,
  editLink,
  DeleteLink,
  AddSocialLink,
  GetSocialLinks,
  ReorderSocialLinks,
  UpdateSocialLink,
  DeleteSocialLink,
  AddHeader,
  DeleteHeader,
  updateUsername,
};
