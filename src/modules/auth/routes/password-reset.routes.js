const express = require("express");

const {
    requestPasswordReset,
    resetPassword
} = require("../controllers/password-reset.controller");

const router = express.Router();

router.post(
    "/forgot-password",
    requestPasswordReset
);

router.post(
    "/reset-password",
    resetPassword
);

module.exports = router;    