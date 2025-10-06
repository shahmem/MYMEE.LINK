const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));


app.use("/uploads", express.static("uploads"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

connectDB();

const AuthRoutes = require("./routes/auth");
const LinkRoutes = require("./routes/links");
const UserRoutes = require("./routes/user");
const ThemeRoutes = require("./routes/theme");


app.use("/api/auth", AuthRoutes);      
app.use("/api", LinkRoutes);           
app.use("/api", UserRoutes);           
app.use("/api", ThemeRoutes);  

app.get("/", (req, res) => {
  res.json({ message: "mymee.link API is running!" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!", error: err.message });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
