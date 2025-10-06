// routes/user.js 
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { GetUser, AddHeader, DeleteHeader, UpdateProfile, updateUsername } = require('../controllers/userController');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Routes
router.get('/user', GetUser);
router.put('/user/:userId/username', updateUsername);
router.get('/user/:userId', GetUser);
router.put('/user/:userId/header', AddHeader);
router.put('/profile/:id', upload.single("img"), UpdateProfile);
router.delete('/user/:userId/header/delete', DeleteHeader);

module.exports = router;
