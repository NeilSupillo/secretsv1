require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const secretRoutes = require("./routes/secretRoutes");

require("./config/passport-setup");

const app = express();

app.use(express.static(__dirname + "/public"));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

const url = process.env.MONGO_URL;
mongoose
  .connect(url, { useNewUrlParser: true })
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.log(`error connected to db ${err}`);
  });

app.use(authRoutes);
app.use(userRoutes);
app.use(secretRoutes);

app.get("/", function (req, res) {
  res.render("home");
});

app.get("/duplicate", function (req, res) {
  res.render("duplicate");
});

app.get("/forget", function (req, res) {
  res.render("forget", { user: "" });
});

app.listen(3000, function () {
  console.log("Server started on port 3000.");
});
