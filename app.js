import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import env from "dotenv";
import { URL } from "url";
import passportLocalMongoose from "passport-local-mongoose";

const __dirname = new URL(".", import.meta.url).pathname;

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));
app.set("views", "views");
app.set("view engine", "ejs");

// app.use(express.static(__dirname + "public"));
// app.set("views", __dirname + "views");
// app.set("view engine", "ejs");

app.use(passport.initialize());
app.use(passport.session());

// const db = new pg.Client({
//   user: process.env.PG_USER,
//   host: process.env.PG_HOST,
//   database: process.env.PG_DATABASE,
//   password: process.env.PG_PASSWORD,
//   port: process.env.PG_PORT,
// });
// db.connect();
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
  secrets: [
    {
      secret: String,
    },
  ],
});
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);

/* app gets request */
app.get("/", function (req, res) {
  res.render("home.ejs");
});

app.get("/duplicate", function (req, res) {
  res.render("duplicate");
});

app.get("/register", function (req, res) {
  res.render("register", { user: "" });
});
app.get("/forget", function (req, res) {
  res.render("forget", { user: "" });
});
app.get("/login", (req, res) => {
  res.render("login", { user: "" });
});
app.get("/login/:message", (req, res) => {
  const par = req.params.message;

  res.render("login", { user: par });
});
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});
app.get("/secrets", async (req, res) => {
  //console.log("/secrets get");
  //console.log(req.user);

  ////////////////UPDATED GET SECRETS ROUTE/////////////////
  if (req.isAuthenticated()) {
    try {
      const foundUsers = await User.find({
        secrets: { $exists: true, $not: { $size: 0 } },
      });
      // console.log("secrets");
      // console.log(foundUsers);

      //console.log(result);
      //  const secret = result.rows[0].secret;
      //   console.log(secret);
      if (foundUsers.length != 0) {
        res.render("secrets.ejs", { usersWithSecrets: foundUsers });
      } else {
        res.render("secrets.ejs", {
          usersWithSecrets: ["Jack Bauer is my hero."],
        });
      }
    } catch (err) {
      console.log(err);
    }
  } else {
    res.redirect("/login");
  }
});
//see account
app.get("/account", async function (req, res) {
  //console.log("submit user " + req.user);
  //console.log(req);
  console.log("/submit get");
  if (req.isAuthenticated()) {
    const user = await User.findById(req.user._id);

    res.render("account", { user: user, wrong: "" });
  } else {
    res.redirect("/login");
  }
});
// ** post request ** //

app.post("/login", function (req, res, next) {
  passport.authenticate("local", async function (err, user, info) {
    console.log("all" + err, user, info);
    if (err) {
      if (err === "wrong password") {
        return res.render("login", { user: "wrong" });
      } else {
        return res.render("login", { user: "email" });
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
app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await User.findOne({ email: email }).exec();
    console.log(checkResult);
    if (checkResult) {
      res.render("login", { user: "already registered" });
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          // const result = await db.query(
          //   "INSERT INTO people (email, password) VALUES ($1, $2) RETURNING *",
          //   [email, hash]
          // );
          const result = await User.create({ email: email, password: hash });
          //const user = result.rows[0];
          console.log(result);
          req.login(result, (err) => {
            console.log("success");
            res.redirect("/secrets");
          });
        }
      });
    }
  } catch (err) {
    res.render("register", { user: "registered" });
    console.log(err);
  }
});
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
app.post("/submit", async function (req, res) {
  console.log("post /submit");
  const submittedSecret = req.body.secret;
  console.log(req.user);
  const cus = {
    secret: submittedSecret,
  };
  try {
    // await db.query(`UPDATE people SET secret = $1 WHERE email = $2`, [
    //   submittedSecret,
    //   req.user.email,
    // ]);
    const foundUser = await User.findById(req.user._id);

    console.log(foundUser);
    foundUser.secrets.push(cus);
    foundUser.save();
    res.redirect("/secrets");
  } catch (err) {
    res.redirect("/login");
    console.log(err);
  }
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
  console.log("change password" + req.body);
  console.log("change password user" + req.user);
  const email = await User.findOne({ email: req.body.username });
  if (email) {
    email.setPassword(req.body.password, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        console.log(user);
        // res.redirect("/login");
      }
    });
  } else {
    res.render("forget", { user: "not found" });
  }

  // User.findOne({ email: req.body.username }).then(
  //   function (sanitizedUser) {
  //     if (sanitizedUser) {
  //       sanitizedUser.setPassword(req.body.password, function () {
  //         sanitizedUser.save();
  //         res.render("login", { user: "forget success" });
  //       });
  //     } else {
  //       res.render("forget", { user: "not found" });
  //       //es.status(500).json({ message: "This user does not exist" });
  //     }
  //   },
  //   function (err) {
  //     console.error(err);
  //   }
  // );
});

app.post("/setPassword", async function (req, res) {
  //console.log(req.body);
  User.findOne({ username: req.body.email }).then(
    function (sanitizedUser) {
      if (sanitizedUser) {
        sanitizedUser.setPassword(req.body.password, function () {
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
  //console.log("delete user info " + req.user);
  try {
    await User.findByIdAndDelete(req.user._id);
    res.redirect("/register");
  } catch (error) {
    console.log(error.message);
  }
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      // const result = await db.query("SELECT * FROM people WHERE email = $1 ", [
      //   username,
      // ]);
      const result = await User.findOne({ email: username }).exec();
      //console.log(result);
      if (result) {
        //const user = result.rows[0];
        const storedHashedPassword = result.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(false, result);
            } else {
              return cb("wrong password", false);
            }
          }
        });
      } else {
        //console.log("User not found");
        return cb("User not found", false);
      }
    } catch (err) {
      //console.log(err);
    }
  })
);

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

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      const info = profile._json;
      try {
        const result = await User.findOne({ email: info.email }).exec();

        if (!result) {
          const newUser = await User.create({
            email: profile.email,
            password: "google",
          });
          //const user = result.rows[0];
          console.log(newUser);

          return cb(null, newUser);
        } else {
          return cb(null, result);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
