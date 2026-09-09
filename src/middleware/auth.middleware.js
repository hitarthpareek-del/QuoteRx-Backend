const {
  verifyAccessToken
} = require("../utils/tokens");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const payload = verifyAccessToken(token);

    if (!payload.sub || !payload.role) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token"
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token"
    });
  }
}

module.exports = {
  authenticate
};