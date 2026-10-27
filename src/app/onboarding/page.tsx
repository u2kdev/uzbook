import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { businesses } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata: Metadata = { title: "Настройка бизнеса" };

export default async function OnboardingPage() {
  const session = await requireUser();
  const db = await getDb();
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, session.id))
    .limit(1);
  if (business) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-paper">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,rgba(110,86,248,0.15),transparent_65%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 py-12">
        <div className="mb-8">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
            Шаг 1 из 2
          </p>
          <h1 className="mt-3 text-[clamp(1.9rem,4vw,2.6rem)] leading-[1.08] font-semibold">
            Как называется ваш бизнес?
          </h1>
          <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-muted">
            Это имя увидят клиенты на странице записи. Адрес можно изменить позже.
          </p>
        </div>

        <div className="rounded-[28px] bg-white/60 p-1.5 ring-1 ring-black/[0.05]">
          <div className="rounded-[calc(28px-6px)] bg-white p-6 ring-1 ring-black/[0.03] sm:p-8">
            <OnboardingForm />
          </div>
        </div>
      </div>
    </div>
  );
}
