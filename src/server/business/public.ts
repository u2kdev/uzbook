import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import {
  businesses,
  galleryImages,
  pageSections,
  services,
  staff,
  staffServices,
  type Business,
  type Service,
} from "@/server/db/schema";
import { addDays, todayInZone } from "@/server/booking/time";
import { getPreviewSlots, type TimeSlot } from "@/server/booking/slots";

export type PublicPageSection = {
  id: string;
  type: string;
  config: Record<string, unknown>;
  sortOrder: number;
};

export type PublicStaff = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  color: string;
  serviceIds: string[];
  nextSlots: { date: string; slots: TimeSlot[] } | null;
};

export type PublicGalleryImage = {
  id: string;
  url: string;
  beforeUrl: string | null;
  caption: string | null;
};

export type PublicBusiness = {
  business: Business;
  services: Service[];
  staff: PublicStaff[];
  categories: { name: string; count: number }[];
  pageSections: PublicPageSection[];
  gallery: PublicGalleryImage[];
};

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function getPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const db = await getDb();
  const business = await getBusinessBySlug(slug);
  if (!business || business.status !== "ACTIVE") return null;

  const [serviceRows, staffRows, links, sections, galleryRows] = await Promise.all([
    db
      .select()
      .from(services)
      .where(and(eq(services.businessId, business.id), eq(services.isActive, true)))
      .orderBy(asc(services.sortOrder), asc(services.name)),
    db
      .select()
      .from(staff)
      .where(and(eq(staff.businessId, business.id), eq(staff.isActive, true)))
      .orderBy(asc(staff.sortOrder), asc(staff.name)),
    db
      .select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId })
      .from(staffServices)
      .innerJoin(staff, eq(staffServices.staffId, staff.id))
      .where(eq(staff.businessId, business.id)),
    db
      .select({ id: pageSections.id, type: pageSections.type, config: pageSections.config, sortOrder: pageSections.sortOrder })
      .from(pageSections)
      .where(and(eq(pageSections.businessId, business.id), eq(pageSections.enabled, true)))
      .orderBy(asc(pageSections.sortOrder)),
    db
      .select({
        id: galleryImages.id,
        url: galleryImages.url,
        beforeUrl: galleryImages.beforeUrl,
        caption: galleryImages.caption,
      })
      .from(galleryImages)
      .where(eq(galleryImages.businessId, business.id))
      .orderBy(asc(galleryImages.sortOrder), asc(galleryImages.createdAt)),
  ]);

  const linksByStaff = new Map<string, string[]>();
  for (const link of links) {
    const list = linksByStaff.get(link.staffId) ?? [];
    list.push(link.serviceId);
    linksByStaff.set(link.staffId, list);
  }

  const today = todayInZone(business.timezone);

  const publicStaff: PublicStaff[] = await Promise.all(
    staffRows.map(async (member) => {
      const serviceIds = linksByStaff.get(member.id) ?? [];
      let next: { date: string; slots: TimeSlot[] } | null = null;
      if (serviceIds.length > 0) {
        for (let offset = 0; offset < 14; offset++) {
          const date = addDays(today, offset);
          const slots = await getPreviewSlots(
            member.id,
            date,
            business.timezone,
            business.settings,
            5,
          );
          if (slots.length > 0) {
            next = { date, slots };
            break;
          }
        }
      }
      return {
        id: member.id,
        name: member.name,
        title: member.title,
        bio: member.bio,
        photoUrl: member.photoUrl,
        color: member.color,
        serviceIds,
        nextSlots: next,
      };
    }),
  );

  const catMap = new Map<string, number>();
  for (const service of serviceRows) {
    const key = service.category?.trim() || "Услуги";
    catMap.set(key, (catMap.get(key) ?? 0) + 1);
  }

  return {
    business,
    services: serviceRows,
    staff: publicStaff,
    categories: [...catMap.entries()].map(([name, count]) => ({ name, count })),
    pageSections: sections as PublicPageSection[],
    gallery: galleryRows,
  };
}

export async function getOwnerServices(businessId: string) {
  const db = await getDb();
  return db
    .select()
    .from(services)
    .where(eq(services.businessId, businessId))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function getOwnerStaff(businessId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.businessId, businessId))
    .orderBy(asc(staff.sortOrder), asc(staff.name));
  if (rows.length === 0) return [];
  const links = await db
    .select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId })
    .from(staffServices)
    .where(inArray(staffServices.staffId, rows.map((r) => r.id)));
  return rows.map((member) => ({
    ...member,
    serviceIds: links.filter((l) => l.staffId === member.id).map((l) => l.serviceId),
  }));
}
