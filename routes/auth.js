// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require('dotenv').config();

// Initialize Twilio client
const twilio = require('twilio');
const nodemailer = require('nodemailer');

// Store OTPs temporarily (in production, use Redis)
const otpStore = new Map();
const emailOtpStore = new Map();

// Configure email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // or your email service
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
    }
  });
};

// Send OTP via Email
const sendEmailOTP = async (email, otp) => {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Mymee.link - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Verify Your Email</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="color: #6b7280; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Email OTP Error:", error);
    return { success: false, error: error.message };
  }
};
// 1. Send OTP to Email
router.post("/send-email-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ 
            message: "Email is required" 
        });
    }
    
    // Validate email format
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ 
            message: "Invalid email format" 
        });
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        return res.status(400).json({ 
            message: "Email already registered" 
        });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (5 minutes)
    emailOtpStore.set(email.toLowerCase(), {
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000
    });

    
    // Send OTP via Email
    const result = await sendEmailOTP(email, otp);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: "Failed to send OTP. Please try again.",
        error: result.error
      });
    }
    
    res.status(200).json({ 
      message: "OTP sent successfully to your email",
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });
    
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 2. Verify Email OTP
router.post("/verify-email-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ 
        message: "Email and OTP are required" 
      });
    }
    
    const otpData = emailOtpStore.get(email.toLowerCase());
    
    if (!otpData) {
      return res.status(400).json({ 
        message: "OTP expired or not found" 
      });
    }
    
    if (Date.now() > otpData.expiresAt) {
      emailOtpStore.delete(email.toLowerCase());
      return res.status(400).json({ 
        message: "OTP has expired" 
      });
    }
    
    if (otpData.otp !== otp) {
      return res.status(400).json({ 
        message: "Invalid OTP" 
      });
    }
    
    // OTP is valid - return success
    res.status(200).json({
      message: "Email verified successfully",
      verified: true
    });
    
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 3. Complete Email Signup (Create Account)
router.post("/complete-email-signup", async (req, res) => {
  try {
    const { email, otp, username, password } = req.body;
    
    if (!email || !otp || !username || !password ) {
      return res.status(400).json({ 
        message: "All fields are required" 
      });
    }
    
    // Verify OTP again
    const otpData = emailOtpStore.get(email.toLowerCase());
    
    if (!otpData || otpData.otp !== otp) {
      return res.status(400).json({ 
        message: "Invalid or expired OTP" 
      });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ 
      username: username.toLowerCase() 
    });
    if (existingUsername) {
      return res.status(400).json({ 
        message: "Username already taken" 
      });
    }
    
    // Check if email already exists (double check)
    const existingEmail = await User.findOne({ 
      email: email.toLowerCase() 
    });
    if (existingEmail) {
      return res.status(400).json({ 
        message: "Email already registered" 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      auth_id: email.toLowerCase(), // Use email as auth_id for email signups
      password: hashedPassword,
      isVerified: true,
      theme: {}
    });
    
    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser._id, 
        username: newUser.username 
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "30d" }
    );
    
    // Clear OTP from store
    emailOtpStore.delete(email.toLowerCase());
    
    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        profileImage: newUser.profileImage,
        bio: newUser.bio
      }
    });
    
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 4. Resend Email OTP
router.post("/resend-email-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        message: "Email is required" 
      });
    }
    
    // Generate new OTP
    const otp = generateOTP();
    
    // Update OTP store
    emailOtpStore.set(email.toLowerCase(), {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    
    // Send new OTP
    const result = await sendEmailOTP(email, otp);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: "Failed to resend OTP",
        error: result.error
      });
    }
    
    res.status(200).json({ 
      message: "OTP resent successfully",
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });
    
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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
      to: `whatsapp:${phoneNumber}`
    });
    
    console.log('OTP sent successfully. Message SID:', message.sid);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error("WhatsApp OTP Error:", error.message);
    return { success: false, error: error.message };
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. Check username availability
router.post("/check-username", async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.length < 3) {
      return res.status(400).json({ 
        available: false, 
        message: "Username must be at least 3 characters" 
      });
    }
    
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        available: false, 
        message: "Username can only contain lowercase letters, numbers, and underscores" 
      });
    }
    
    const existingUser = await User.findOne({ 
      username: username.toLowerCase() 
    });
    
    if (existingUser) {
      return res.status(200).json({ 
        available: false, 
        message: "Username already taken" 
      });
    }
    
    res.status(200).json({ 
      available: true, 
      message: "Username is available" 
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
        message: "WhatsApp number is required" 
      });
    }
    
    if (!/^\+?[1-9]\d{1,14}$/.test(whatsapp)) {
      return res.status(400).json({ 
        available: false, 
        message: "Invalid phone number format" 
      });
    }
    
    const existingUser = await User.findOne({ auth_id: whatsapp });
    
    if (existingUser) {
      return res.status(200).json({ 
        available: false, 
        message: "WhatsApp number already registered" 
      });
    }
    
    res.status(200).json({ 
      available: true, 
      message: "WhatsApp number is available" 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 3. Send OTP to WhatsApp
router.post("/send-otp", async (req, res) => {
  try {
    const { whatsapp, username, password } = req.body;
    
    if (!whatsapp || !username || !password ) {
      return res.status(400).json({ 
        message: "All fields are required" 
      });
    }
    
    // Check if username already exists
    const existingUsername = await User.findOne({ 
      username: username.toLowerCase() 
    });
    if (existingUsername) {
      return res.status(400).json({ 
        message: "Username already taken" 
      });
    }
    
    // Check if WhatsApp number already exists
    const existingWhatsApp = await User.findOne({ auth_id: whatsapp });
    if (existingWhatsApp) {
      return res.status(400).json({ 
        message: "WhatsApp number already registered" 
      });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(whatsapp, {
      otp,
      userData: { whatsapp, username, password },
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    
    // Send OTP via WhatsApp
    const result = await sendWhatsAppOTP(whatsapp, otp);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: "Failed to send OTP. Please try again.",
        error: result.error
      });
    }
    
    res.status(200).json({ 
      message: "OTP sent successfully to WhatsApp",
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });
    
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// 4. Verify OTP and Create Account
router.post("/verify-otp", async (req, res) => {
  try {
    const { whatsapp, otp } = req.body;
    
    if (!whatsapp || !otp) {
      return res.status(400).json({ 
        message: "WhatsApp number and OTP are required" 
      });
    }
    
    const otpData = otpStore.get(whatsapp);
    
    if (!otpData) {
      return res.status(400).json({ 
        message: "OTP expired or not found" 
      });
    }
    
    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(whatsapp);
      return res.status(400).json({ 
        message: "OTP has expired" 
      });
    }
    
    if (otpData.otp !== otp) {
      return res.status(400).json({ 
        message: "Invalid OTP" 
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
      theme: {}
    });
    
    await newUser.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: newUser._id, 
        username: newUser.username 
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
        bio: newUser.bio
      }
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
        message: "WhatsApp number and password are required" 
      });
    }
    
    const user = await User.findOne({ username: username });
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid credentials" 
      });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid credentials" 
      });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username 
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
        bio: user.bio
      }
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
        message: "WhatsApp number is required" 
      });
    }
    
    const existingData = otpStore.get(whatsapp);
    
    if (!existingData) {
      return res.status(400).json({ 
        message: "No pending signup found" 
      });
    }
    
    const otp = generateOTP();
    
    otpStore.set(whatsapp, {
      ...existingData,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });
    
    const result = await sendWhatsAppOTP(whatsapp, otp);
    
    if (!result.success) {
      return res.status(500).json({ 
        message: "Failed to resend OTP",
        error: result.error
      });
    }
    
    res.status(200).json({ 
      message: "OTP resent successfully",
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
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