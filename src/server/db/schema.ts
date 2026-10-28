import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", ["OWNER", "SUPPORT", "ADMIN"]);
export const businessStatusEnum = pgEnum("business_status", ["DRAFT", "ACTIVE", "SUSPENDED"]);
export const planEnum = pgEnum("plan", ["TRIAL", "START", "PRO", "BUSINESS"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
]);
export const bookingSourceEnum = pgEnum("booking_source", ["WEB", "TELEGRAM", "MANUAL"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "TRIAL",
  "PENDING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
]);
export const paymentProviderEnum = pgEnum("payment_provider", [
  "MANUAL",
  "TELEGRAM_STARS",
  "STRIPE",
  "CRYPTO",
  "PAYME",
  "CLICK",
  "DEMO",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "CREATED",
  "PENDING",
  "PAID",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
]);

export const pageSectionTypeEnum = pgEnum("page_section_type", [
  "hero",
  "staff",
  "services",
  "contacts",
  "reviews",
  "promotions",
  "faq",
  "gallery",
  "vacancies",
  "custom_html",
]);

/* ------------------------------------------------------------------ */
/* JSON shapes                                                         */
/* ------------------------------------------------------------------ */

export type BusinessSettings = {
  slotStepMin: number;
  leadTimeMin: number;
  maxAdvanceDays: number;
  cancellationHours: number;
  autoConfirm: boolean;
  showPrices: boolean;
  requireEmail: boolean;
  telegramNotifications?: {
    newBooking?: boolean;
    cancelled?: boolean;
    rescheduled?: boolean;
    payment?: boolean;
    digest?: boolean;
  };
};

export type BusinessTheme = {
  accent: string;
  mode: "light" | "dark";
  fontPair?: number;
};

export const DEFAULT_SETTINGS: BusinessSettings = {
  slotStepMin: 15,
  leadTimeMin: 30,
  maxAdvanceDays: 60,
  cancellationHours: 3,
  autoConfirm: true,
  showPrices: true,
  requireEmail: false,
};

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export const pageSections = pgTable(
  "page_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    type: pageSectionTypeEnum("type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    config: jsonb("config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("page_sections_business_idx").on(t.businessId),
    index("page_sections_business_sort_idx").on(t.businessId, t.sortOrder),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    role: userRoleEnum("role").notNull().default("OWNER"),
    telegramId: text("telegram_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_telegram_uq").on(t.telegramId),
  ],
);

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("beauty"),
    tagline: text("tagline"),
    description: text("description"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    address: text("address"),
    city: text("city"),
    phone: text("phone"),
    instagram: text("instagram"),
    website: text("website"),
    timezone: text("timezone").notNull().default("Asia/Tashkent"),
    currency: text("currency").notNull().default("UZS"),
    status: businessStatusEnum("status").notNull().default("ACTIVE"),
    plan: planEnum("plan").notNull().default("TRIAL"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    settings: jsonb("settings").$type<BusinessSettings>().notNull().default(DEFAULT_SETTINGS),
    theme: jsonb("theme")
      .$type<BusinessTheme>()
      .notNull()
      .default({ accent: "#7c5cff", mode: "light", fontPair: 0 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("businesses_slug_uq").on(t.slug),
    index("businesses_owner_idx").on(t.ownerId),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title"),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    color: text("color").notNull().default("#7c5cff"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("staff_business_idx").on(t.businessId)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    durationMin: integer("duration_min").notNull().default(60),
    bufferBeforeMin: integer("buffer_before_min").notNull().default(0),
    bufferAfterMin: integer("buffer_after_min").notNull().default(10),
    price: integer("price").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("services_business_idx").on(t.businessId)],
);

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

/** Recurring weekly availability. weekday: 0 = Sunday … 6 = Saturday. Minutes from midnight. */
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [index("working_hours_staff_idx").on(t.staffId, t.weekday)],
);

/** Date-specific override: day off (isClosed) or custom hours. */
export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    isClosed: boolean("is_closed").notNull().default(true),
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
  },
  (t) => [uniqueIndex("schedule_exception_uq").on(t.staffId, t.date)],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    telegramId: text("telegram_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("clients_business_phone_uq").on(t.businessId, t.phone),
    index("clients_business_idx").on(t.businessId),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone").notNull(),
    clientEmail: text("client_email"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: bookingStatusEnum("status").notNull().default("CONFIRMED"),
    source: bookingSourceEnum("source").notNull().default("WEB"),
    price: integer("price").notNull().default(0),
    durationMin: integer("duration_min").notNull().default(60),
    note: text("note"),
    manageToken: text("manage_token").notNull(),
    cancelReason: text("cancel_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_manage_token_uq").on(t.manageToken),
    index("bookings_business_start_idx").on(t.businessId, t.startAt),
    index("bookings_staff_start_idx").on(t.staffId, t.startAt),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("TRIAL"),
    provider: paymentProviderEnum("provider").notNull().default("MANUAL"),
    amount: integer("amount").notNull().default(0),
    currency: text("currency").notNull().default("UZS"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscriptions_business_idx").on(t.businessId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull(),
    provider: paymentProviderEnum("provider").notNull(),
    status: paymentStatusEnum("status").notNull().default("CREATED"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("UZS"),
    /** Our public order id, used in checkout URLs and provider callbacks. */
    externalId: text("external_id").notNull(),
    providerTxnId: text("provider_txn_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_external_id_uq").on(t.externalId),
    index("payments_business_idx").on(t.businessId),
    index("payments_status_idx").on(t.status),
  ],
);

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: text("caption"),
    beforeUrl: text("before_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("gallery_images_business_idx").on(t.businessId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  businesses: many(businesses),
  auditLogs: many(auditLogs),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, { fields: [businesses.ownerId], references: [users.id] }),
  staff: many(staff),
  services: many(services),
  bookings: many(bookings),
  pageSections: many(pageSections),
  payments: many(payments),
}));

export const staffRelations = relations(staff, ({ one, many }) => ({
  business: one(businesses, { fields: [staff.businessId], references: [businesses.id] }),
  workingHours: many(workingHours),
  staffServices: many(staffServices),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  business: one(businesses, { fields: [services.businessId], references: [businesses.id] }),
  staffServices: many(staffServices),
}));

export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  staff: one(staff, { fields: [staffServices.staffId], references: [staff.id] }),
  service: one(services, { fields: [staffServices.serviceId], references: [services.id] }),
}));

export const pageSectionsRelations = relations(pageSections, ({ one }) => ({
  business: one(businesses, { fields: [pageSections.businessId], references: [businesses.id] }),
}));

export const galleryImagesRelations = relations(galleryImages, ({ one }) => ({
  business: one(businesses, { fields: [galleryImages.businessId], references: [businesses.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  business: one(businesses, { fields: [payments.businessId], references: [businesses.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PageSection = typeof pageSections.$inferSelect;
export type GalleryImage = typeof galleryImages.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

