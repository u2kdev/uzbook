import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { getMyBusiness } from "@/server/auth/session";
import { createTelegramLinkToken, botUsername } from "@/server/telegram/link";
import { telegramConfigured } from "@/server/telegram/notify";
import { PageEditor } from "@/components/dashboard/page-editor";
import { getOwnerServices, getOwnerStaff } from "@/server/business/public";
import { getSections } from "@/server/actions/page-sections";
import { listGalleryImages } from "@/server/actions/gallery";

export const dynamic = "force-dynamic";
export const metadata = { title: "Страница салона" };

export default async function ProfilePage() {
  const { session, business } = await getMyBusiness();
  if (!business) return null;

  const db = await getDb();
  const [services, staff, linkToken, sections, gallery, [userRow]] = await Promise.all([
    getOwnerServices(business.id),
    getOwnerStaff(business.id),
    createTelegramLinkToken(session.id),
    getSections(),
    listGalleryImages(),
    db.select({ telegramId: users.telegramId }).from(users).where(eq(users.id, session.id)).limit(1),
  ]);

  const username = botUsername();
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const telegramLink =
    username && telegramConfigured()
      ? `https://t.me/${username}?start=link_${linkToken}`
      : null;

  return (
    <PageEditor
      publicUrl={`${appUrl}/${business.slug}`}
      servicesCount={services.filter((service) => service.isActive).length}
      staffCount={staff.filter((member) => member.isActive).length}
      telegram={{
        configured: telegramConfigured(),
        link: telegramLink,
        connected: Boolean(userRow?.telegramId),
        telegramId: userRow?.telegramId ?? null,
      }}
      sections={sections.map((section) => ({
        ...section,
        config: (section.config ?? {}) as Record<string, unknown>,
        createdAt: section.createdAt.toISOString(),
        updatedAt: section.updatedAt.toISOString(),
      }))}
      galleryImages={gallery}
      business={{
        id: business.id,
        name: business.name,
        slug: business.slug,
        category: business.category,
        tagline: business.tagline,
        description: business.description,
        city: business.city,
        address: business.address,
        phone: business.phone,
        instagram: business.instagram,
        website: business.website,
        logoUrl: business.logoUrl,
        coverUrl: business.coverUrl,
        accent: business.theme.accent,
        theme: {
          accent: business.theme.accent,
          mode: business.theme.mode ?? "light",
          fontPair: business.theme.fontPair ?? 0,
        },
        settings: business.settings,
      }}
    />
  );
}
