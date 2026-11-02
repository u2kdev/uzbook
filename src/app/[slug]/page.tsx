import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, Clock, Lock, Phone } from "lucide-react";
import { getPublicBusiness } from "@/server/business/public";
import { SalonPage } from "@/components/public/salon-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) return { title: "Страница не найдена" };

  const { business } = data;
  if (data.isSuspended) {
    return {
      title: `${business.name} — онлайн-запись временно недоступна`,
      description: `Онлайн-запись в ${business.name} временно приостановлена.`,
    };
  }

  return {
    title: `${business.name} — запись онлайн`,
    description:
      business.tagline ??
      business.description ??
      `Онлайн-запись в ${business.name}. Выберите услугу, мастера и удобное время.`,
    openGraph: {
      title: `${business.name} — запись онлайн`,
      description: business.tagline ?? undefined,
      type: "website",
    },
  };
}

export default async function PublicSalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicBusiness(slug);
  if (!data) notFound();

  const { business } = data;

  if (data.isSuspended) {
    const isTrial = data.suspensionReason === "trial_expired";
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-12 text-center">
        <div className="w-full max-w-md rounded-[28px] border border-line bg-white p-7 shadow-sm sm:p-9">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber/10 text-amber">
            <Lock size={22} strokeWidth={1.8} />
          </div>

          <span className="mt-4 inline-block rounded-full bg-paper px-3 py-1 text-[11px] font-semibold text-muted">
            {business.name}
          </span>

          <h1 className="mt-3 text-[20px] font-bold tracking-tight text-ink">
            Онлайн-запись временно недоступна
          </h1>

          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
            {isTrial
              ? `У салона «${business.name}» истёк бесплатный пробный период. Страница онлайн-записи временно отключена до выбора тарифа владельцем.`
              : `Приём онлайн-записей для салона «${business.name}» временно приостановлен.`}
          </p>

          {business.phone && (
            <div className="mt-5 rounded-2xl border border-line bg-paper/60 p-3.5">
              <p className="text-[11.5px] text-muted">Связаться с салоном напрямую:</p>
              <a
                href={`tel:${business.phone}`}
                className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[14px] text-brand hover:underline"
              >
                <Phone size={14} />
                {business.phone}
              </a>
            </div>
          )}

          <div className="mt-8 border-t border-line/70 pt-5 text-[11.5px] text-muted">
            Вы владелец салона?{" "}
            <Link
              href="/login"
              className="font-semibold text-ink underline underline-offset-4 hover:text-brand"
            >
              Войти в кабинет
            </Link>{" "}
            для подключения тарифа.
          </div>
        </div>
      </div>
    );
  }

  return (
    <SalonPage
      data={{
        business: {
          name: business.name,
          slug: business.slug,
          category: business.category,
          tagline: business.tagline,
          description: business.description,
          logoUrl: business.logoUrl,
          coverUrl: business.coverUrl,
          address: business.address,
          city: business.city,
          phone: business.phone,
          instagram: business.instagram,
          website: business.website,
          timezone: business.timezone,
          currency: business.currency,
          accent: business.theme.accent,
          mode: business.theme.mode ?? "light",
          fontPair: business.theme.fontPair ?? 0,
          showPrices: business.settings.showPrices,
        },
        services: data.services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          durationMin: service.durationMin,
          price: service.price,
          category: service.category,
        })),
        staff: data.staff.map((member) => ({
          id: member.id,
          name: member.name,
          title: member.title,
          bio: member.bio,
          photoUrl: member.photoUrl,
          color: member.color,
          serviceIds: member.serviceIds,
          nextSlots: member.nextSlots
            ? {
                date: member.nextSlots.date,
                slots: member.nextSlots.slots.map((slot) => ({
                  start: slot.start,
                  label: slot.label,
                })),
              }
            : null,
        })),
        pageSections: data.pageSections,
        gallery: data.gallery,
      }}
    />
  );
}
