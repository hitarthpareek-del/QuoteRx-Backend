const prisma = require("../../../lib/prisma");

const {
  hashPassword
} = require("../../../utils/password");

const {
  hashToken
} = require("../../../utils/tokens");

async function setupPassword(token, password) {
  if (!token || !password) {
    throw new Error("TOKEN_AND_PASSWORD_REQUIRED");
  }

  if (password.length < 8) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const tokenHash = hashToken(token);

  const setupToken =
    await prisma.passwordSetupToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: true
      }
    });

  if (!setupToken) {
    throw new Error("INVALID_SETUP_TOKEN");
  }

  if (setupToken.usedAt) {
    throw new Error("SETUP_TOKEN_ALREADY_USED");
  }

  if (setupToken.expiresAt <= new Date()) {
    throw new Error("SETUP_TOKEN_EXPIRED");
  }

  const user = setupToken.user;

  if (user.status !== "PENDING") {
    throw new Error("USER_NOT_PENDING");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        passwordHash,
        status: "ACTIVE",
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    }),

    prisma.passwordSetupToken.update({
      where: {
        id: setupToken.id
      },
      data: {
        usedAt: new Date()
      }
    }),

    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_SETUP",
        entity: "User",
        entityId: user.id
      }
    })
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: "ACTIVE",
    emailVerified: true
  };
}

module.exports = {
  setupPassword
};