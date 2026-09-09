const express = require("express");

const {
    setupPassword
} = require("../controllers/password-setup.controller");

const router = express.Router();

router.post(
    "/setup-password",
    setupPassword
);

module.exports = router;