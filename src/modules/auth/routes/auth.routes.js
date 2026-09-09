const express = require("express");

const {
  login,
  refresh,
  logout,
  me
} = require("../controllers/auth.controller");

const {
  authenticate
} = require("../../../middleware/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

router.get("/me", authenticate, me);

module.exports = router;