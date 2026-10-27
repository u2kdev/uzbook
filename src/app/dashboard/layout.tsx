import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { DashboardShell } from "@/components/dashboard/shell";
import { expireBusinessIfNeeded } from "@/server/limits";

export const metadata: Metadata = { title: "Кабинет" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  if (session.role !== "OWNER") redirect("/admin");

  const db = await getDb();
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);

  if (!business) redirect("/onboarding");

  const currentBusiness = await expireBusinessIfNeeded(business);

  const trialDaysLeft =
    currentBusiness.plan === "TRIAL" && currentBusiness.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (currentBusiness.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
          ),
        )
      : null;
  const trialExpired =
    currentBusiness.plan === "TRIAL" &&
    Boolean(currentBusiness.trialEndsAt) &&
    (currentBusiness.trialEndsAt as Date).getTime() < Date.now();

  return (
    <DashboardShell
      user={{ name: session.name, email: session.email }}
      business={{
        name: currentBusiness.name,
        slug: currentBusiness.slug,
        plan: currentBusiness.plan,
        trialEndsAt: currentBusiness.trialEndsAt?.toISOString() ?? null,
        trialDaysLeft,
        trialExpired,
      }}
    >
      {children}
    </DashboardShell>
  );
}
