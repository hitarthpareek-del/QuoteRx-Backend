const passwordResetService =
  require("../services/password-reset.service");

async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    await passwordResetService.requestPasswordReset(
      email
    );

    /*
     * Deliberately generic response.
     *
     * Don't reveal whether the email exists.
     */
    return res.json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent."
    });
  } catch (error) {
    console.error(
      "Password reset request error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Could not process password reset request"
    });
  }
}

async function resetPassword(req, res) {
  try {
    const {
      token,
      password
    } = req.body;

    await passwordResetService.resetPassword(
      token,
      password
    );

    return res.json({
      success: true,
      message:
        "Password reset successful. You can now log in."
    });
  } catch (error) {
    console.error(
      "Password reset error:",
      error
    );

    const errors = {
      TOKEN_AND_PASSWORD_REQUIRED: [
        400,
        "Token and password are required"
      ],

      PASSWORD_TOO_SHORT: [
        400,
        "Password must be at least 8 characters"
      ],

      INVALID_RESET_TOKEN: [
        400,
        "Invalid password reset link"
      ],

      RESET_TOKEN_ALREADY_USED: [
        400,
        "This password reset link has already been used"
      ],

      RESET_TOKEN_EXPIRED: [
        400,
        "This password reset link has expired"
      ],

      ACCOUNT_NOT_ACTIVE: [
        403,
        "Account is not active"
      ]
    };

    const response =
      errors[error.message];

    if (response) {
      return res.status(response[0]).json({
        success: false,
        message: response[1]
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not reset password"
    });
  }
}

module.exports = {
  requestPasswordReset,
  resetPassword
};