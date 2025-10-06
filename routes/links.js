const express = require("express");
const router = express.Router();
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
 
const { AddLinks, GetLinks, ReorderLink, editLink, DeleteLink, AddSocialLink, GetSocialLinks, ReorderSocialLinks, DeleteSocialLink, UpdateSocialLink } = require('../controllers/userController');
const upload = multer({ storage });

router.post("/links/:userId", upload.single("icon"), AddLinks );
router.get("/links/:userId", GetLinks );
router.put("/links/reorder/:userId", ReorderLink );
router.put("/links/edit/:userId",upload.single("icon"), editLink );
router.delete("/links/:userId", DeleteLink ); 
router.post("/sociallinks/:userId", AddSocialLink );
router.get("/sociallinks/:userId", GetSocialLinks );
router.put("/sociallinks/reorder/:userId", ReorderSocialLinks );
router.put("/sociallinks/:userId", UpdateSocialLink );
router.delete("/sociallinks/:userId", DeleteSocialLink ); 


module.exports = router; 