const express = require("express");
const passport = require("passport");
const router = express.Router();

// Google Auth
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);

// Facebook Auth
router.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: "public_profile" })
);

router.get(
  "/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);

module.exports = router;
