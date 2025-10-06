const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI;

const connectDB = async () => {
  if (!mongoURI) {
    console.error("MongoDB URI is not defined in .env");
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoURI);
    console.log("MongoDB Connected Successfully!");
  } catch (err) {
    console.error("MongoDB Connection Failed:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
