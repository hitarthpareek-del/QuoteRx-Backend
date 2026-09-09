const passwordSetupService =
  require("../services/password-setup.service");

async function setupPassword(req, res) {
  try {
    const {
      token,
      password
    } = req.body;

    const user =
      await passwordSetupService.setupPassword(
        token,
        password
      );

    return res.json({
      success: true,
      message: "Password setup successful. Your account is now active.",
      user
    });
  } catch (error) {
    console.error(
      "Password setup error:",
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

      INVALID_SETUP_TOKEN: [
        400,
        "Invalid password setup link"
      ],

      SETUP_TOKEN_ALREADY_USED: [
        400,
        "This password setup link has already been used"
      ],

      SETUP_TOKEN_EXPIRED: [
        400,
        "This password setup link has expired"
      ],

      USER_NOT_PENDING: [
        400,
        "This user is no longer pending password setup"
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
      message: "Could not set up password"
    });
  }
}

module.exports = {
  setupPassword
};