const prisma = require("../../../lib/prisma");

const {
  createAccessToken,
  createRefreshToken,
  hashToken
} = require("../../../utils/tokens");

const {
  verifyPassword
} = require("../../../utils/password");

const REFRESH_TOKEN_EXPIRES_DAYS =
  Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase().trim()
    }
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("ACCOUNT_NOT_ACTIVE");
  }

  if (!user.passwordHash) {
    throw new Error("PASSWORD_NOT_SET");
  }

  const passwordValid = await verifyPassword(
    password,
    user.passwordHash
  );

  if (!passwordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const accessToken = createAccessToken(user);

  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS
  );

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt
      }
    }),

    prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        lastLoginAt: new Date()
      }
    }),

    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entity: "User",
        entityId: user.id
      }
    })
  ]);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
      adminId: user.adminId,
      managerId: user.managerId
    }
  };
}

async function refresh(refreshToken) {
  const tokenHash = hashToken(refreshToken);

  const existingToken =
    await prisma.refreshToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: true
      }
    });

  if (!existingToken) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  if (existingToken.revokedAt) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  if (existingToken.expiresAt <= new Date()) {
    throw new Error("REFRESH_TOKEN_EXPIRED");
  }

  const user = existingToken.user;

  if (user.status !== "ACTIVE") {
    throw new Error("ACCOUNT_NOT_ACTIVE");
  }

  const newAccessToken = createAccessToken(user);

  const newRefreshToken = createRefreshToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);

  const newExpiresAt = new Date();

  newExpiresAt.setDate(
    newExpiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS
  );

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: {
        id: existingToken.id
      },
      data: {
        revokedAt: new Date()
      }
    }),

    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt
      }
    })
  ]);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}

async function logout(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const tokenHash = hashToken(refreshToken);

  const token = await prisma.refreshToken.findUnique({
    where: {
      tokenHash
    }
  });

  if (!token) {
    return;
  }

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: {
        id: token.id
      },
      data: {
        revokedAt: new Date()
      }
    }),

    prisma.auditLog.create({
      data: {
        userId: token.userId,
        action: "LOGOUT",
        entity: "User",
        entityId: token.userId
      }
    })
  ]);
}

module.exports = {
  login,
  refresh,
  logout
};