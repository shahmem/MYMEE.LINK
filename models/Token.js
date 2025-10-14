// models/Token.js - Temporary Token System
const mongoose = require("mongoose");

const TokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      length: 8,
      validate: {
        validator: function (v) {
          return /^[A-Z0-9]{8}$/.test(v);
        },
        message: "Token must be 8 alphanumeric characters",
      },
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "tokens",
  }
);

// Index for faster lookups
TokenSchema.index({ token: 1 });
TokenSchema.index({ isUsed: 1 });

// Static method to check if token is valid and available
TokenSchema.statics.isTokenValid = async function (token) {
  const tokenDoc = await this.findOne({
    token: token.toUpperCase(),
    isUsed: false,
  });
  return !!tokenDoc;
};

// Static method to mark token as used
TokenSchema.statics.markAsUsed = async function (token, userId) {
  const result = await this.findOneAndUpdate(
    { token: token.toUpperCase(), isUsed: false },
    {
      isUsed: true,
      usedBy: userId,
      usedAt: new Date(),
    },
    { new: true }
  );
  return result;
};

module.exports = mongoose.model("Token", TokenSchema);