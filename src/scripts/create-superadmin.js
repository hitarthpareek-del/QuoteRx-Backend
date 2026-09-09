require("dotenv").config();

const readline = require("readline");
const prisma = require("../lib/prisma");
const {
  hashPassword
} = require("../utils/password");

function askQuestion(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("");
  console.log("=== Create SUPERADMIN ===");
  console.log("");

  const existingSuperadmin =
    await prisma.user.count({
      where: {
        role: "SUPERADMIN"
      }
    });

  if (existingSuperadmin > 0) {
    console.error(
      "A SUPERADMIN already exists."
    );

    process.exit(1);
  }

  const name = await askQuestion("Name: ");
  const email = await askQuestion("Email: ");
  const password = await askQuestion("Password: ");

  if (!name || !email || !password) {
    throw new Error(
      "Name, email and password are required."
    );
  }

  if (password.length < 8) {
    throw new Error(
      "Password must be at least 8 characters."
    );
  }

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email: email.toLowerCase()
      }
    });

  if (existingUser) {
    throw new Error(
      "A user with this email already exists."
    );
  }

  const passwordHash =
    await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      phoneNumber: null,
      userPrefix: null,
      passwordHash,

      role: "SUPERADMIN",
      status: "ACTIVE",

      emailVerified: true,
      emailVerifiedAt: new Date(),

      companyId: null,
      adminId: null,
      managerId: null
    }
  });

  console.log("");
  console.log("SUPERADMIN created successfully.");
  console.log("");
  console.log({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error("Failed:", error.message);
    console.error("");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });