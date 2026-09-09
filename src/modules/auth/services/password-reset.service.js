const prisma = require("../../../lib/prisma");

const {
  hashPassword
} = require("../../../utils/password");

const {
  createPasswordSetupToken,
  hashToken
} = require("../../../utils/tokens");

const {
  sendPasswordResetEmail
} = require("./email.service");

async function requestPasswordReset(email) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    }
  });

  /*
   * Always return success even when the email
   * does not exist. This prevents email enumeration.
   */
  if (!user) {
    return;
  }

  if (
    user.status === "DEACTIVATED" ||
    user.status === "SUSPENDED"
  ) {
    return;
  }

  const resetToken = createPasswordSetupToken();
  const resetTokenHash = hashToken(resetToken);

  const expiresAt = new Date();

  expiresAt.setHours(
    expiresAt.getHours() +
    Number(
      process.env.PASSWORD_RESET_TOKEN_EXPIRES_HOURS || 1
    )
  );

  /*
   * Invalidate previous unused reset tokens.
   */
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    }),

    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetTokenHash,
        expiresAt
      }
    }),

    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entity: "User",
        entityId: user.id
      }
    })
  ]);

  await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetToken
  });
}

async function resetPassword(token, password) {
  if (!token || !password) {
    throw new Error("TOKEN_AND_PASSWORD_REQUIRED");
  }

  if (password.length < 8) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const tokenHash = hashToken(token);

  const resetToken =
    await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: true
      }
    });

  if (!resetToken) {
    throw new Error("INVALID_RESET_TOKEN");
  }

  if (resetToken.usedAt) {
    throw new Error("RESET_TOKEN_ALREADY_USED");
  }

  if (resetToken.expiresAt <= new Date()) {
    throw new Error("RESET_TOKEN_EXPIRED");
  }

  const user = resetToken.user;

  if (user.status !== "ACTIVE") {
    throw new Error("ACCOUNT_NOT_ACTIVE");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        passwordHash
      }
    }),

    prisma.passwordResetToken.update({
      where: {
        id: resetToken.id
      },
      data: {
        usedAt: new Date()
      }
    }),

    /*
     * Revoke all existing refresh sessions.
     *
     * This logs the user out from all devices after
     * a password reset.
     */
    prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    }),

    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET",
        entity: "User",
        entityId: user.id
      }
    })
  ]);
}

module.exports = {
  requestPasswordReset,
  resetPassword
};