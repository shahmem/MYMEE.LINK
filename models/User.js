// models/User.js - Fixed duplicate index warnings
const mongoose = require("mongoose");

// Social Link Schema
const SocialLinkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      lowercase: true,
      enum: [
        "instagram", "call", "contact", "facebook", "twitter", 
        "youtube", "linkedin", "tiktok", "spotify", "github", 
        "behance", "dribbble", "discord", "reddit", "telegram", 
        "twitch", "pinterest", "whatsapp", "snapchat", "clubhouse", 
        "amazon", "flipkart", "googleplay", "email", "music", "podcast"
      ],
    },
    url: { type: String, required: true },
    icon: { type: String, required: true },
    socialorder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const LinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    url: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: "URL must start with http:// or https://",
      },
    },
    icon: { type: String },
    order: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    thumbnail: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ThemeSchema = new mongoose.Schema(
  {
    name: { type: String, default: "custom" },
    bgColor: { type: String, default: "#ffffff" },
    bgImage: { type: String, default: "" },
    bgVideo: { type: String, default: "" },
    bgGradient: { type: String, default: "" },
    nameColor: { type: String, default: "#000000" },
    bioColor: { type: String, default: "rgba(0,0,0,0.40)" },
    headerColor: { type: String, default: "#000000" },
    iconColor: { type: String, default: "#ffffff" },
    iconBg: { type: String, default: "#00000032" },
    linkColor: { type: String, default: "#ffffff" },
    linkBg: { type: String, default: "#00000072" },
    linkRadius: { type: String, default: "24px" },
    linkBorder: { type: String, default: "none" },
    linkShadow: { type: String, default: "none" },
    fontStyle: { type: String, default: "Arial, sans-serif" },
    fontSize: { type: String, default: "16px" },
    buttonStyle: {
      type: String,
      enum: ["fill", "outline", "shadow", "soft"],
      default: "fill",
    },
    animation: { type: Boolean, default: true },
  },
  { _id: false }
);

const AnalyticsSchema = new mongoose.Schema(
  {
    totalViews: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    lastVisit: { type: Date },
    monthlyViews: { type: Number, default: 0 },
    monthlyClicks: { type: Number, default: 0 },
  },
  { _id: false }
);

// Main User Schema
const UserSchema = new mongoose.Schema(
  {
    // Authentication - Removed index: true here since we use .index() below
    auth_id: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\S+@\S+\.\S+$/.test(v);
        },
        message: "Invalid email format",
      },
    },

    // Profile
    name: { type: String, trim: true, maxlength: 20 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      validate: {
        validator: function (v) {
          return /^[a-z0-9_]+$/.test(v);
        },
        message: "Username can only contain lowercase letters, numbers, and underscores",
      },
    },
    profileImage: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 200 },
    header: { type: String, default: "", maxlength: 100 },

    // Links
    links: [LinkSchema],
    socialLinks: [SocialLinkSchema],

    // Theme
    theme: {
      type: ThemeSchema,
      default: () => ({}),
    },

    // Settings
    socialPosition: { type: String, enum: ["top", "bottom"], default: "top" },
    urlFormat: {
      type: String,
      enum: ["subdomain", "path"],
      default: "subdomain",
    },
    isPublic: { type: Boolean, default: true },
    customDomain: { type: String, default: "" },

    // Analytics
    analytics: {
      type: AnalyticsSchema,
      default: () => ({}),
    },

    // Subscription
    plan: {
      type: String,
      enum: ["free", "pro", "business"],
      default: "free",
    },
    subscriptionExpiry: { type: Date },

    // Metadata
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// Create indexes - Only define them once here
UserSchema.index({ username: 1 });
UserSchema.index({ auth_id: 1 });
UserSchema.index({ email: 1 });

// Pre-save middleware
UserSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  if (this.links && this.links.length > 0) {
    this.links.sort((a, b) => a.order - b.order);
  }
  if (this.socialLinks && this.socialLinks.length > 0) {
    this.socialLinks.sort((a, b) => a.socialorder - b.socialorder);
  }

  next();
});

// Instance methods
UserSchema.methods.getPublicProfile = function () {
  return {
    name: this.name,
    username: this.username,
    profileImage: this.profileImage,
    bio: this.bio,
    header: this.header,
    links: this.links.filter((link) => link.active),
    socialLinks: this.socialLinks.filter((link) => link.active),
    theme: this.theme,
    socialPosition: this.socialPosition,
  };
};

// Static methods
UserSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.toLowerCase() });
};

module.exports = mongoose.model("User", UserSchema);