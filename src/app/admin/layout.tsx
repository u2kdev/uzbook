import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = { title: "Админка" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  if (session.role !== "ADMIN" && session.role !== "SUPPORT") return null;

  const db = await getDb();
  const [pending] = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(eq(subscriptions.status, "PENDING"));

  return (
    <AdminShell
      user={{ name: session.name, email: session.email, role: session.role }}
      pendingCount={pending?.value ?? 0}
    >
      {children}
    </AdminShell>
  );
}
