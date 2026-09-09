const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m"
    }
  );
}

function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function createPasswordSetupToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function verifyAccessToken(token) {
  return jwt.verify(
    token,
    process.env.JWT_ACCESS_SECRET
  );
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  createPasswordSetupToken,
  hashToken,
  verifyAccessToken
};