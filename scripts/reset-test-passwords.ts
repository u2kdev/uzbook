import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/server/db";
import { users, businesses, subscriptions } from "../src/server/db/schema";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

async function main() {
  const db = await getDb();

  const accounts = [
    {
      email: "admin@uzbook.online",
      name: "Админ платформы",
      password: "admin1234",
      role: "ADMIN" as const,
    },
    {
      email: "owner@uzbook.online",
      name: "Мадина Каримова (Owner)",
      password: "owner1234",
      role: "OWNER" as const,
    },
    {
      email: "support@uzbook.online",
      name: "Поддержка",
      password: "support1234",
      role: "SUPPORT" as const,
    },
    {
      email: "demo@uzbook.online",
      name: "Мадина Каримова (Atelier Noir)",
      password: "demo1234",
      role: "OWNER" as const,
    },
    {
      email: "barber@uzbook.online",
      name: "Рустам Каримов (Barber House)",
      password: "barber1234",
      role: "OWNER" as const,
    },
  ];

  console.log("=== RESETTING TEST PASSWORDS ===");

  for (const acc of accounts) {
    const passwordHash = await bcrypt.hash(acc.password, 10);

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, acc.email))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({
          passwordHash,
          role: acc.role,
          name: acc.name,
        })
        .where(eq(users.id, existing.id));
      console.log(`Updated user: ${acc.email} (${acc.role})`);
    } else {
      await db.insert(users).values({
        email: acc.email,
        name: acc.name,
        passwordHash,
        role: acc.role,
      });
      console.log(`Created user: ${acc.email} (${acc.role})`);
    }

    // Verify password check
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, acc.email))
      .limit(1);

    const match = await bcrypt.compare(acc.password, user.passwordHash);
    if (!match) {
      throw new Error(`Verification failed for ${acc.email}`);
    }
    console.log(`  -> Verified: ${acc.email} / ${acc.password} [OK]`);
  }

  // Link Atelier Noir with PRO plan to owner@uzbook.online
  const [ownerUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "owner@uzbook.online"))
    .limit(1);

  const [atelier] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, "atelier-noir"))
    .limit(1);

  if (atelier && ownerUser) {
    await db
      .update(businesses)
      .set({
        ownerId: ownerUser.id,
        plan: "PRO",
        status: "ACTIVE",
        trialEndsAt: null,
      })
      .where(eq(businesses.id, atelier.id));

    const periodEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await db.insert(subscriptions).values({
      businessId: atelier.id,
      plan: "PRO",
      status: "ACTIVE",
      provider: "DEMO",
      amount: 199_000,
      currency: "UZS",
      startedAt: new Date(),
      currentPeriodEnd: periodEnd,
      note: "Подписка PRO активна",
    });
    console.log("Linked Atelier Noir (PRO plan) to owner@uzbook.online [OK]");
  }

  console.log("\n=== ALL TEST CREDENTIALS SUCCESSFULLY RESET AND VERIFIED ===");
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
