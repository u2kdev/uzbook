import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
