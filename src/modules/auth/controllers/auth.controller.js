const authService = require("../services/auth.service");

const REFRESH_COOKIE_NAME = "quotation_refresh_token";

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge:
      Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30) *
      24 *
      60 *
      60 *
      1000
  };
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const result = await authService.login(
      email,
      password
    );

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      refreshCookieOptions()
    );

    return res.json({
      success: true,
      message: "Login successful",
      accessToken: result.accessToken,
      user: result.user
    });
  } catch (error) {
    console.error("Login error:", error);

    if (error.message === "INVALID_CREDENTIALS") {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    if (error.message === "ACCOUNT_NOT_ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active"
      });
    }

    if (error.message === "PASSWORD_NOT_SET") {
      return res.status(403).json({
        success: false,
        message: "Password has not been set"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
}

async function refresh(req, res) {
  try {
    const refreshToken =
      req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token missing"
      });
    }

    const result = await authService.refresh(
      refreshToken
    );

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      refreshCookieOptions()
    );

    return res.json({
      success: true,
      accessToken: result.accessToken
    });
  } catch (error) {
    console.error("Refresh error:", error);

    res.clearCookie(
      REFRESH_COOKIE_NAME,
      refreshCookieOptions()
    );

    if (
      error.message === "INVALID_REFRESH_TOKEN" ||
      error.message === "REFRESH_TOKEN_EXPIRED"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
    }

    if (error.message === "ACCOUNT_NOT_ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not refresh session"
    });
  }
}

async function logout(req, res) {
  try {
    const refreshToken =
      req.cookies[REFRESH_COOKIE_NAME];

    await authService.logout(refreshToken);

    res.clearCookie(
      REFRESH_COOKIE_NAME,
      refreshCookieOptions()
    );

    return res.json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.clearCookie(
      REFRESH_COOKIE_NAME,
      refreshCookieOptions()
    );

    return res.json({
      success: true,
      message: "Logout successful"
    });
  }
}

async function me(req, res) {
  try {
    const user = await require("../lib/prisma").user.findUnique({
      where: {
        id: req.user.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        companyId: true,
        adminId: true,
        managerId: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Me error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch user"
    });
  }
}

module.exports = {
  login,
  refresh,
  logout,
  me
};