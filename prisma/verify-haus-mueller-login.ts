/**
 * Run inside app container: npx tsx prisma/verify-haus-mueller-login.ts
 * Verifies the Haus Müller owner exists and password "owner123" matches.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "owner@haus-mueller.de";
  const password = "owner123";

  const user = await prisma.user.findUnique({
    where: { email },
    include: { restaurant: true },
  });

  if (!user) {
    console.error("FAIL: No user with email", email);
    process.exit(1);
  }

  const match = await bcrypt.compare(password, user.hashedPassword);
  if (!match) {
    console.error("FAIL: Password does not match for", email);
    process.exit(1);
  }

  console.log("OK: User exists and password matches.");
  console.log("  Email:", user.email);
  console.log("  Name:", user.name);
  console.log("  Restaurant:", user.restaurant?.slug ?? user.restaurantId);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
