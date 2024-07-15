//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");
//var LocalStrategy = require("passport-local").Strategy;
const app = express();

app.use(express.static(__dirname + "/public"));
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

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
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secrets: [
    {
      secret: String,
    },
  ],
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});
/* facebook */
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_ID,
      clientSecret: process.env.FACEBOOK_SECRET,
      callbackURL:
        "https://secret-website-nine.vercel.app/auth/auth/facebook/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate(
        { username: profile.displayName, facebookId: profile.id },
        function (err, user) {
          if (err) {
            return cb(null, false);
          }
          return cb(err, user);
        }
      );
    }
  )
);
/* facebook get request */
app.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: "public_profile" })
);
app.get(
  "/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async function (accessToken, refreshToken, profile, cb) {
      const info = profile._json;
      //console.log(profile._json);
      await User.findOrCreate(
        { email: info.email, googleId: info.sub },
        function (err, user) {
          if (err) {
            return cb(null, false);
          }
          return cb(err, user);
        }
      );
    }
  )
);
/* google get request */
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);
/* app gets request */
app.get("/", function (req, res) {
  res.render("home");
});

app.get("/login", function (req, res) {
  //console.log(req);
  //console.log("find" + req.user);
  //console.log("statusCode: ", res.statusCode);
  res.render("login", { user: "" });
});
app.get("/register", function (req, res) {
  res.render("register", { user: "" });
});
app.get("/forget", function (req, res) {
  res.render("forget", { user: "" });
});
// get and see user secrets
app.get("/secrets", async function (req, res) {
  console.log("secrets user " + req.user);
  if (req.isAuthenticated()) {
    const foundUsers = await User.find({
      secrets: { $exists: true, $not: { $size: 0 } },
    });
    //console.log(foundUsers)
    //.then( ()=>{
    req.session.save(() => {
      res.render("secrets", { usersWithSecrets: foundUsers });
    });
    /* })
   .catch( (err)=>{
       console.log(err) 
   })  */
  } else {
    res.redirect("/login");
  }
});

app.get("/account", async function (req, res) {
  //console.log("submit user " + req.user.hash);
  //console.log(req);
  if (req.isAuthenticated()) {
    const userId = await User.findById(req.user.id);
    // console.log("/submit " + userId);
    req.session.save(() => {
      res.render("account", { user: userId, wrong: "" });
    });
  } else {
    res.redirect("/login");
  }
});
//logout
app.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/");
});
/* app post request */
//submit a secret /secrets
app.post("/submit", async function (req, res) {
  const submittedSecret = req.body.secret;
  const cus = {
    secret: submittedSecret,
  };

  // console.log(req.user.id);
  const foundUser = await User.findById(req.user.id);
  if (foundUser) {
    foundUser.secrets.push(cus);
    foundUser.save();
    res.redirect("/secrets");
  } else {
    res.redirect("/login");
    console.log(err);
  }
});
//register
app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        //console.log(err);
        res.render("register", { user: "registered" });
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});
//log in

//edit a secret
app.post("/edit", async function (req, res) {
  const editVal = req.body.secret;
  const delId = req.body.hisId;
  const secretId = req.body.del;
  //console.log(editVal);
  const a = await User.findOneAndUpdate(
    { _id: delId, "secrets._id": secretId },
    {
      $set: { "secrets.$.secret": editVal },
    }
  );
  //console.log(a);
  res.redirect("/secrets");
});
// change password
app.post("/changePassword", function (req, res) {
  //console.log("change password" + req.body);
  // console.log("change password user" + req.user);
  //console.log(req.user);
  req.user.changePassword(req.body.current, req.body.new, function (err) {
    if (err) {
      //res.redirect("/submit");
      res.render("account", { user: req.user, wrong: "wrong pass" });
    } else {
      res.render("login", { user: "change pass" });
    }
  });
});
// forget password
app.post("/forget", async function (req, res) {
  User.findOne({ username: req.body.username }).then(
    function (sanitizedUser) {
      if (sanitizedUser) {
        sanitizedUser.setPassword(req.body.password, function () {
          sanitizedUser.save();
          res.render("login", { user: "forget success" });
        });
      } else {
        res.render("forget", { user: "not found" });
        //es.status(500).json({ message: "This user does not exist" });
      }
    },
    function (err) {
      console.error(err);
    }
  );
});
app.post("/setPassword", async function (req, res) {
  console.log(req.body);
  User.findOne({ email: req.body.email }).then(
    function (sanitizedUser) {
      if (sanitizedUser) {
        sanitizedUser.setPassword(req.body.password, function () {
          sanitizedUser.username = req.body.email;
          sanitizedUser.save();
          res.render("login", { user: "set success" });
        });
      } else {
        res.status(500).json({ message: "Something goes wrong" });
      }
    },
    function (err) {
      console.error(err);
    }
  );
});
// delete a secret
app.post("/delete", function (req, res) {
  const delId = req.body.hisId;
  const secretId = req.body.del;
  //console.log("deleted secret "+delId, secretId);
  User.updateOne({ _id: delId }, { $pull: { secrets: { _id: secretId } } })
    .then(() => {
      res.redirect("/account");
    })
    .catch((err) => {
      console.log(`error connected to db ${err}`);
    });
});
//delete account
app.post("/deleteAccount", async function (req, res) {
  console.log("delete user info " + req.user);
  try {
    await User.findByIdAndDelete(req.user._id);
    res.redirect("/register");
  } catch (error) {
    console.log(error.message);
  }
});

app.post("/login", function (req, res, next) {
  passport.authenticate("local", async function (err, user, info) {
    //console.log("all" + err, user, info);
    if (err) {
      //console.log("err" + err);
      return next(err);
    }
    if (!user) {
      //console.log("user " + err);
      const email = await User.findOne({ username: req.body.username }).lean();
      if (!email) {
        return res.render("login", { user: "email" });
      } else {
        return res.render("login", { user: "wrong" });
      }
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      //console.log(user);
      return res.redirect("/secrets");
    });
  })(req, res, next);
});

app.listen(3000, function () {
  console.log("Server started on port 3000.");
});
