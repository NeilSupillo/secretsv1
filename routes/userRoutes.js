const express = require("express");
const passport = require("passport");
const User = require("../models/User");
const router = express.Router();
let wrong = "";
let user = "";
router.get("/register", function (req, res) {
  res.render("register", { user: "" });
});

router.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        res.render("register", { user: "registered" });
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});

router.get("/login", function (req, res) {
  res.render("login", { user: user });
  user = "";
});

router.post("/login", function (req, res, next) {
  passport.authenticate("local", async function (err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
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
      return res.redirect("/secrets");
    });
  })(req, res, next);
});

router.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/");
});

router.get("/account", async function (req, res) {
  if (req.isAuthenticated()) {
    const userId = await User.findById(req.user.id);
    req.session.save(() => {
      res.render("account", { user: userId, wrong: wrong });
      wrong = "";
    });
  } else {
    res.redirect("/login");
  }
});

router.post("/changePassword", function (req, res) {
  req.user.changePassword(req.body.current, req.body.new, function (err) {
    if (err) {
      wrong = "wrong pass";
      res.redirect("/account");
      //res.render("account", { user: req.user });
    } else {
      res.render("login", { user: "change pass" });
    }
  });
});

router.post("/forget", async function (req, res) {
  User.findOne({ username: req.body.username }).then(
    function (sanitizedUser) {
      if (sanitizedUser) {
        sanitizedUser.setPassword(req.body.password, function () {
          sanitizedUser.save();
          res.render("login", { user: "forget success" });
        });
      } else {
        res.render("forget", { user: "not found" });
      }
    },
    function (err) {
      console.error(err);
    }
  );
});

router.post("/setPassword", async function (req, res) {
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

router.post("/deleteAccount", async function (req, res) {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.redirect("/register");
  } catch (error) {
    res.redirect("/register");
    console.log(error.message);
  }
});

module.exports = router;
