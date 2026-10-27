import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/server/db";
import { users } from "../src/server/db/schema";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Администратор";

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env (or in the command environment) before running admin:create.",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, name, role: "ADMIN" })
      .where(eq(users.id, existing.id));
    console.log(`Updated platform administrator: ${email}`);
  } else {
    await db.insert(users).values({ email, passwordHash, name, role: "ADMIN" });
    console.log(`Created platform administrator: ${email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
