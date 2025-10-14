// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Token = require("../models/Token");
require("dotenv").config();

// Initialize Twilio client
const twilio = require("twilio");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();
const emailOtpStore = new Map();

const sendEmailOTP = async (email, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Mymee.link <noreply@mymee.link>", // ✅ Change this line
      to: email,
      subject: "Mymee.link - Email Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email</h2>
          <p style="font-size: 16px;">Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This code will expire in 5 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Resend Error:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Email sent successfully:", data.id);
    return { success: true };
  } catch (error) {
    console.error("❌ Email OTP Error:", error);
    return { success: false, error: error.message };
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

router.post("/check-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        isValid: false,
        message: "Token is required",
      });
    }

    if (token.length !== 8) {
      return res.status(400).json({
        isValid: false,
        message: "Token must be 8 characters",
      });
    }

    if (!/^[A-Z0-9]{8}$/.test(token.toUpperCase())) {
      return res.status(400).json({
        isValid: false,
        message: "Token must contain only letters and numbers",
      });
    }

    const tokenDoc = await Token.findOne({
      token: token.toUpperCase(),
    });

    if (!tokenDoc) {
      return res.status(200).json({
        isValid: false,
        message: "Invalid token",
      });
    }

    if (tokenDoc.isUsed) {
      return res.status(200).json({
        isValid: false,
        message: "This token has already been used",
      });
    }

    res.status(200).json({
      isValid: true,
      message: "Token is valid",
    });
  } catch (error) {
    console.error("❌ Check Token Error:", error);
    res.status(500).json({
      isValid: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// 1. Send OTP to Email
router.post("/send-email-otp", async (req, res) => {
  try {
    const { email, signupToken } = req.body;
    console.log("📧 Sending OTP to:", email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // 🔑 Validate token
    if (!signupToken || signupToken.length !== 8) {
      return res.status(400).json({ message: "Valid signup token is required" });
    }

    const isValidToken = await Token.isTokenValid(signupToken);
    if (!isValidToken) {
      return res.status(400).json({ message: "Invalid or already used token" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const otp = generateOTP();
    console.log("🔢 Generated OTP:", otp);

    emailOtpStore.set(email.toLowerCase(), {
      otp,
      signupToken: signupToken.toUpperCase(), // Store token with OTP data
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const result = await sendEmailOTP(email, otp);
    console.log("📤 Send result:", result);

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to send OTP. Please try again.",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "OTP sent successfully to your email",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("❌ Server error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// 2. Resend Email OTP
router.post("/resend-email-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingOtp = emailOtpStore.get(email.toLowerCase());
    if (!existingOtp) {
      return res
        .status(400)
        .json({ message: "No pending OTP found for this email" });
    }

    const otp = generateOTP();

    emailOtpStore.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const result = await sendEmailOTP(email, otp);

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to resend OTP. Please try again.",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "OTP resent successfully to your email",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("❌ Resend OTP Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 3. Verify Email OTP
router.post("/verify-email-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const otpData = emailOtpStore.get(email.toLowerCase());

    if (!otpData) {
      return res.status(400).json({
        message: "OTP expired or not found",
      });
    }

    if (Date.now() > otpData.expiresAt) {
      emailOtpStore.delete(email.toLowerCase());
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    res.status(200).json({
      message: "Email verified successfully",
      verified: true,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 4. Complete Email Signup (Create Account)
router.post("/complete-email-signup", async (req, res) => {
  try {
    const { email, otp, username, password, signupToken } = req.body;

    console.log("📝 Complete Signup Request:", {
      email,
      username,
      hasOtp: !!otp,
      hasPassword: !!password,
      hasToken: !!signupToken,
    });

    if (!email || !otp || !username || !password || !signupToken) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const otpData = emailOtpStore.get(email.toLowerCase());
    console.log("🔍 OTP Check:", {
      found: !!otpData,
      otpMatch: otpData?.otp === otp,
    });

    if (!otpData || otpData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // 🔑 Verify token matches the one from OTP request
    if (otpData.signupToken !== signupToken.toUpperCase()) {
      return res.status(400).json({
        message: "Token mismatch. Please restart signup process.",
      });
    }

    // 🔑 Final token validation before creating user
    const isValidToken = await Token.isTokenValid(signupToken);
    if (!isValidToken) {
      return res.status(400).json({
        message: "Invalid or already used token",
      });
    }

    const existingUsername = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUsername) {
      return res.status(400).json({
        message: "Username already taken",
      });
    }

    const existingEmail = await User.findOne({
      email: email.toLowerCase(),
    });
    if (existingEmail) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: username,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      auth_id: email.toLowerCase(),
      password: hashedPassword,
      isVerified: true,
      theme: {},
    });

    await newUser.save();
    console.log("✅ User created:", newUser._id);

    // 🔑 Mark token as used
    await Token.markAsUsed(signupToken, newUser._id);
    console.log("✅ Token marked as used");

    const token = jwt.sign(
      {
        userId: newUser._id,
        username: newUser.username,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    emailOtpStore.delete(email.toLowerCase());

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        profileImage: newUser.profileImage,
        bio: newUser.bio,
      },
    });
  } catch (error) {
    console.error("❌ Complete Signup Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});
// WhatsApp OTP Service (using Twilio SDK)
const sendWhatsAppOTP = async (phoneNumber, otp) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      body: `Your Mymee.link verification code is: ${otp}. Valid for 5 minutes.`,
      to: `whatsapp:${phoneNumber}`,
    });

    console.log("OTP sent successfully. Message SID:", message.sid);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error("WhatsApp OTP Error:", error.message);
    return { success: false, error: error.message };
  }
};

// 1. Check username availability
router.post("/check-username", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || username.length < 3) {
      return res.status(400).json({
        available: false,
        message: "Username must be at least 3 characters",
      });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({
        available: false,
        message:
          "Username can only contain lowercase letters, numbers, and underscores",
      });
    }

    const existingUser = await User.findOne({
      username: username.toLowerCase(),
    });

    if (existingUser) {
      return res.status(200).json({
        available: false,
        message: "Username already taken",
      });
    }

    res.status(200).json({
      available: true,
      message: "Username is available",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 2. Check WhatsApp number availability
router.post("/check-whatsapp", async (req, res) => {
  try {
    const { whatsapp } = req.body;

    if (!whatsapp) {
      return res.status(400).json({
        available: false,
        message: "WhatsApp number is required",
      });
    }

    if (!/^\+?[1-9]\d{1,14}$/.test(whatsapp)) {
      return res.status(400).json({
        available: false,
        message: "Invalid phone number format",
      });
    }

    const existingUser = await User.findOne({ auth_id: whatsapp });

    if (existingUser) {
      return res.status(200).json({
        available: false,
        message: "WhatsApp number already registered",
      });
    }

    res.status(200).json({
      available: true,
      message: "WhatsApp number is available",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 3. Send OTP to WhatsApp
router.post("/send-otp", async (req, res) => {
  try {
    const { whatsapp, username, password, signupToken } = req.body;

    if (!whatsapp || !username || !password || !signupToken) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // 🔑 Validate token
    if (signupToken.length !== 8) {
      return res.status(400).json({ message: "Valid signup token is required" });
    }

    const isValidToken = await Token.isTokenValid(signupToken);
    if (!isValidToken) {
      return res.status(400).json({ message: "Invalid or already used token" });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUsername) {
      return res.status(400).json({
        message: "Username already taken",
      });
    }

    // Check if WhatsApp number already exists
    const existingWhatsApp = await User.findOne({ auth_id: whatsapp });
    if (existingWhatsApp) {
      return res.status(400).json({
        message: "WhatsApp number already registered",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with token
    otpStore.set(whatsapp, {
      otp,
      userData: { whatsapp, username, password },
      signupToken: signupToken.toUpperCase(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Send OTP via WhatsApp
    const result = await sendWhatsAppOTP(whatsapp, otp);

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to send OTP. Please try again.",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "OTP sent successfully to WhatsApp",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// 4. Verify OTP and Create Account
router.post("/verify-otp", async (req, res) => {
  try {
    const { whatsapp, otp, signupToken } = req.body;

    if (!whatsapp || !otp || !signupToken) {
      return res.status(400).json({
        message: "WhatsApp number, OTP, and token are required",
      });
    }

    const otpData = otpStore.get(whatsapp);

    if (!otpData) {
      return res.status(400).json({
        message: "OTP expired or not found",
      });
    }

    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(whatsapp);
      return res.status(400).json({
        message: "OTP has expired",
      });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // 🔑 Verify token matches
    if (otpData.signupToken !== signupToken.toUpperCase()) {
      return res.status(400).json({
        message: "Token mismatch. Please restart signup process.",
      });
    }

    // 🔑 Final token validation
    const isValidToken = await Token.isTokenValid(signupToken);
    if (!isValidToken) {
      return res.status(400).json({
        message: "Invalid or already used token",
      });
    }

    const { username, password, name } = otpData.userData;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      name,
      username: username.toLowerCase(),
      auth_id: whatsapp,
      email: `${username.toLowerCase()}@linkinbio.temp`,
      password: hashedPassword,
      isVerified: true,
      theme: {},
    });

    await newUser.save();

    // 🔑 Mark token as used
    await Token.markAsUsed(signupToken, newUser._id);
    console.log("✅ Token marked as used");

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: newUser._id,
        username: newUser.username,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    otpStore.delete(whatsapp);

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        profileImage: newUser.profileImage,
        bio: newUser.bio,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 5. Login with WhatsApp and Password
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "WhatsApp number and password are required",
      });
    }

    const user = await User.findOne({ username: username });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 6. Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { whatsapp } = req.body;

    if (!whatsapp) {
      return res.status(400).json({
        message: "WhatsApp number is required",
      });
    }

    const existingData = otpStore.get(whatsapp);

    if (!existingData) {
      return res.status(400).json({
        message: "No pending signup found",
      });
    }

    const otp = generateOTP();

    otpStore.set(whatsapp, {
      ...existingData,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const result = await sendWhatsAppOTP(whatsapp, otp);

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to resend OTP",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "OTP resent successfully",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Middleware to verify JWT token
const authMiddleware = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

const passwordResetStore = new Map();

// 1. Request Password Reset OTP (for email users)
router.post("/forgot-password-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        message: "If this email is registered, you will receive a reset code",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with expiration (10 minutes for password reset)
    passwordResetStore.set(email.toLowerCase(), {
      otp,
      userId: user._id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Send OTP via email
    const result = await sendPasswordResetEmail(email, otp);

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to send reset code. Please try again.",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "Password reset code sent to your email",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("❌ Forgot Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 2. Request Password Reset OTP (for WhatsApp users)
router.post("/forgot-password-whatsapp", async (req, res) => {
  try {
    const { whatsapp } = req.body;

    if (!whatsapp) {
      return res.status(400).json({ message: "WhatsApp number is required" });
    }

    // Check if user exists
    const user = await User.findOne({ auth_id: whatsapp });

    if (!user) {
      // Don't reveal if number exists for security
      return res.status(200).json({
        message: "If this number is registered, you will receive a reset code",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with expiration (10 minutes)
    passwordResetStore.set(whatsapp, {
      otp,
      userId: user._id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Send OTP via WhatsApp
    const result = await sendPasswordResetWhatsApp(whatsapp, otp);

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to send reset code. Please try again.",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "Password reset code sent to your WhatsApp",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("❌ Forgot Password WhatsApp Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 3. Verify Password Reset OTP
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { identifier, otp } = req.body; // identifier can be email or whatsapp

    if (!identifier || !otp) {
      return res.status(400).json({
        message: "Identifier and OTP are required",
      });
    }

    const resetData = passwordResetStore.get(identifier.toLowerCase());

    if (!resetData) {
      return res.status(400).json({
        message: "Invalid or expired reset code",
      });
    }

    if (Date.now() > resetData.expiresAt) {
      passwordResetStore.delete(identifier.toLowerCase());
      return res.status(400).json({
        message: "Reset code has expired",
      });
    }

    if (resetData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid reset code",
      });
    }

    // Mark as verified but don't delete yet
    passwordResetStore.set(identifier.toLowerCase(), {
      ...resetData,
      verified: true,
    });

    res.status(200).json({
      message: "Reset code verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("❌ Verify Reset OTP Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 4. Reset Password with OTP
router.post("/reset-password", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;

    if (!identifier || !otp || !newPassword) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const resetData = passwordResetStore.get(identifier.toLowerCase());

    if (!resetData || !resetData.verified) {
      return res.status(400).json({
        message: "Invalid or expired reset session",
      });
    }

    if (Date.now() > resetData.expiresAt) {
      passwordResetStore.delete(identifier.toLowerCase());
      return res.status(400).json({
        message: "Reset session has expired",
      });
    }

    if (resetData.otp !== otp) {
      return res.status(400).json({
        message: "Invalid reset code",
      });
    }

    // Find user and update password
    const user = await User.findById(resetData.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Clear reset data
    passwordResetStore.delete(identifier.toLowerCase());

    // Generate new token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Password reset successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error("❌ Reset Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 5. Resend Password Reset OTP
router.post("/resend-reset-otp", async (req, res) => {
  try {
    const { identifier, type } = req.body; // type: 'email' or 'whatsapp'

    if (!identifier || !type) {
      return res.status(400).json({
        message: "Identifier and type are required",
      });
    }

    const existingReset = passwordResetStore.get(identifier.toLowerCase());

    if (!existingReset) {
      return res.status(400).json({
        message: "No pending reset request found",
      });
    }

    // Generate new OTP
    const otp = generateOTP();

    // Update stored data
    passwordResetStore.set(identifier.toLowerCase(), {
      ...existingReset,
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
    });

    let result;
    if (type === "email") {
      result = await sendPasswordResetEmail(identifier, otp);
    } else {
      result = await sendPasswordResetWhatsApp(identifier, otp);
    }

    if (!result.success) {
      return res.status(500).json({
        message: "Failed to resend reset code",
        error: result.error,
      });
    }

    res.status(200).json({
      message: "Reset code resent successfully",
      devOTP: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error("❌ Resend Reset OTP Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Helper function to send password reset email
const sendPasswordResetEmail = async (email, otp) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "Mymee.link <noreply@mymee.link>",
      to: email,
      subject: "Mymee.link - Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="font-size: 16px;">You requested to reset your password. Use the code below:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This code will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email and your password will remain unchanged.</p>
        </div>
      `,
    });

    if (error) {
      console.error("❌ Resend Error:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Password reset email sent:", data.id);
    return { success: true };
  } catch (error) {
    console.error("❌ Password Reset Email Error:", error);
    return { success: false, error: error.message };
  }
};

// Helper function to send password reset WhatsApp
const sendPasswordResetWhatsApp = async (phoneNumber, otp) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      body: `Your Mymee.link password reset code is: ${otp}. Valid for 10 minutes. If you didn't request this, please ignore.`,
      to: `whatsapp:${phoneNumber}`,
    });

    console.log("✅ Password reset WhatsApp sent:", message.sid);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error("❌ WhatsApp Password Reset Error:", error.message);
    return { success: false, error: error.message };
  }
};

// Protected route - Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
