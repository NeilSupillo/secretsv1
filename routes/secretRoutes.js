const express = require("express");
const User = require("../models/User");
const router = express.Router();

router.get("/secrets", async function (req, res) {
  if (req.isAuthenticated()) {
    const foundUsers = await User.find({
      secrets: { $exists: true, $not: { $size: 0 } },
    });
    req.session.save(() => {
      res.render("secrets", { usersWithSecrets: foundUsers });
    });
  } else {
    res.redirect("/login");
  }
});

router.post("/submit", async function (req, res) {
  const submittedSecret = req.body.secret;
  const cus = { secret: submittedSecret };

  const foundUser = await User.findById(req.user.id);
  if (foundUser) {
    foundUser.secrets.push(cus);
    foundUser.save();
    res.redirect("/secrets");
  } else {
    console.log(err);
  }
});

router.post("/edit", async function (req, res) {
  const editVal = req.body.secret;
  const delId = req.body.hisId;
  const secretId = req.body.del;

  await User.findOneAndUpdate(
    { _id: delId, "secrets._id": secretId },
    { $set: { "secrets.$.secret": editVal } }
  );

  res.redirect("/secrets");
});

router.post("/delete", function (req, res) {
  const delId = req.body.hisId;
  const secretId = req.body.del;

  User.updateOne({ _id: delId }, { $pull: { secrets: { _id: secretId } } })
    .then(() => {
      res.redirect("/account");
    })
    .catch((err) => {
      console.log(`error connected to db ${err}`);
    });
});

module.exports = router;
