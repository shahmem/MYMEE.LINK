const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  GetUser,
  AddHeader,
  DeleteHeader,
  UpdateProfile,
  updateUsername
} = require("../controllers/userController");

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + path.extname(file.originalname)),
});
const upload = multer({ storage });

// User routes
router.get("/user", GetUser);
router.put("/user/:userId/username", updateUsername);
router.get("/user/:userId", GetUser);
router.put("/user/:userId/header", AddHeader);
router.put("/profile/:id", upload.single("img"), UpdateProfile);
router.delete("/user/:userId/header/delete", DeleteHeader);

module.exports = router;
