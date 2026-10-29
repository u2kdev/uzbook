import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../src/server/db";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

if (process.env.NODE_ENV === "production") {
  console.error(
    "Demo seed is disabled in production. Create the first administrator with ADMIN_EMAIL / ADMIN_PASSWORD and `npm run admin:create`.",
  );
  process.exit(1);
}
import {
  bookings,
  businesses,
  pageSections,
  services,
  staff,
  staffServices,
  subscriptions,
  users,
  workingHours,
} from "../src/server/db/schema";

async function main() {
  const db = await getDb();
  const slug = "atelier-noir";

  // Platform & Owner accounts
  const platformAccounts = [
    {
      email: "owner@uzbook.online",
      name: "Мадина Каримова (Owner)",
      password: "owner1234",
      role: "OWNER" as const,
    },
    {
      email: "admin@uzbook.online",
      name: "Админ платформы",
      password: "admin1234",
      role: "ADMIN" as const,
    },
    {
      email: "support@uzbook.online",
      name: "Поддержка",
      password: "support1234",
      role: "SUPPORT" as const,
    },
    {
      email: "demo@uzbook.online",
      name: "Мадина Каримова (Demo)",
      password: "demo1234",
      role: "OWNER" as const,
    },
  ];

  for (const account of platformAccounts) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await db
      .insert(users)
      .values({
        email: account.email,
        name: account.name,
        passwordHash,
        role: account.role,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { role: account.role, passwordHash },
      });
  }

  // Demo tenant with a pending payment request so the admin panel has something to review.
  const pendingSlug = "barber-house";
  const [pendingExisting] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.slug, pendingSlug))
    .limit(1);

  if (!pendingExisting) {
    const [barberOwner] = await db
      .insert(users)
      .values({
        email: "barber@uzbook.online",
        name: "Рустам Каримов",
        passwordHash: await bcrypt.hash("barber1234", 10),
        role: "OWNER",
        phone: "+998935556677",
      })
      .onConflictDoNothing()
      .returning();

    const barberRow =
      barberOwner ??
      (
        await db
          .select()
          .from(users)
          .where(eq(users.email, "barber@uzbook.online"))
          .limit(1)
      )[0];

    const [barberBusiness] = await db
      .insert(businesses)
      .values({
        ownerId: barberRow.id,
        slug: pendingSlug,
        name: "Barber House",
        category: "barbershop",
        tagline: "Мужские стрижки и борода",
        city: "Ташкент",
        address: "ул. Амира Темура, 88",
        phone: "+998 93 555 66 77",
        timezone: "Asia/Tashkent",
        currency: "UZS",
        status: "ACTIVE",
        plan: "TRIAL",
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        settings: {
          slotStepMin: 15,
          leadTimeMin: 30,
          maxAdvanceDays: 60,
          cancellationHours: 3,
          autoConfirm: true,
          showPrices: true,
          requireEmail: false,
        },
        theme: { accent: "#c2683f", mode: "dark", fontPair: 1 },
      })
      .returning();

    await db.insert(subscriptions).values({
      businessId: barberBusiness.id,
      plan: "START",
      status: "PENDING",
      provider: "MANUAL",
      amount: 99_000,
      note: "Демо-заявка: оплата ожидает подтверждения",
    });

    console.log("Seeded pending demo business:", pendingSlug);
  }

  const [existing] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1);
  if (existing) {
    // Ensure page sections exist for existing demo business
    const [existingSection] = await db
      .select({ id: pageSections.id })
      .from(pageSections)
      .where(eq(pageSections.businessId, existing.id))
      .limit(1);
    if (!existingSection) {
      await db.insert(pageSections).values([
        {
          businessId: existing.id,
          type: "hero",
          enabled: true,
          sortOrder: 0,
          config: {
            showNearestSlot: true,
            ctaText: "Записаться онлайн",
          },
        },
        {
          businessId: existing.id,
          type: "staff",
          enabled: true,
          sortOrder: 1,
          config: {
            title: "Мастера",
            subtitle: "Нажмите на мастера, чтобы увидеть свободное время",
            showBio: true,
            columns: 3,
          },
        },
        {
          businessId: existing.id,
          type: "services",
          enabled: true,
          sortOrder: 2,
          config: {
            title: "Услуги",
            subtitle: "Прайс",
            groupByCategory: true,
            showPrices: true,
            showDuration: true,
          },
        },
        {
          businessId: existing.id,
          type: "contacts",
          enabled: true,
          sortOrder: 3,
          config: {
            title: "Контакты",
            showAddress: true,
            showPhone: true,
            showInstagram: true,
            showMap: false,
          },
        },
        {
          businessId: existing.id,
          type: "reviews",
          enabled: true,
          sortOrder: 4,
          config: {
            title: "Отзывы",
            subtitle: "Что говорят наши клиенты",
            items: [
              {
                name: "Дилноза",
                avatar: null,
                rating: 5,
                text: "Лучший салон в городе! Мастера настоящие профессионалы, всегда укладываются во время и результат превосходит ожидания.",
                date: "2026-09-15",
              },
              {
                name: "Руслан",
                avatar: null,
                rating: 5,
                text: "Тимур сделал отличную стрижку и укладку бороды. Атмосфера спокойная, цены адекватные. Теперь только сюда.",
                date: "2026-09-22",
              },
              {
                name: "Сабира",
                avatar: null,
                rating: 4,
                text: "Маникюр с Азизой прошёл на высоте. Дизайн получился именно таким, как хотела. Рекомендую!",
                date: "2026-10-01",
              },
            ],
          },
        },
        {
          businessId: existing.id,
          type: "promotions",
          enabled: true,
          sortOrder: 5,
          config: {
            title: "Акции",
            subtitle: "Специальные предложения",
            items: [
              {
                title: "Первая стрижка -20%",
                description: "Скидка на любую стрижку при первом посещении",
                validUntil: "2026-12-31",
                serviceCategory: "Волосы",
              },
              {
                title: "Маникюр + педикюр",
                description: "При записи на маникюр и педикюр одновременно — скидка 15%",
                validUntil: "2026-12-31",
                serviceCategory: "Ногти",
              },
            ],
          },
        },
        {
          businessId: existing.id,
          type: "faq",
          enabled: true,
          sortOrder: 6,
          config: {
            title: "Частые вопросы",
            items: [
              {
                question: "Как отменить или перенести запись?",
                answer: "После брони вы получите персональную ссылку (на странице и в Telegram). Перейдите по ней — там кнопки «Перенести» и «Отменить». Никаких звонков и логинов.",
              },
              {
                question: "Можно ли прийти без записи?",
                answer: "Лучше записаться заранее — так мы гарантируем время именно для вас. Но если мастер свободен, мы с радостью примем вас и без брони.",
              },
              {
                question: "Какие способы оплаты?",
                answer: "Наличные, карта, перевод по номеру телефона. Оплата после услуги.",
              },
              {
                question: "Есть ли парковка?",
                answer: "У салона небольшая парковка на 3 машины. Также рядом платная городская парковка.",
              },
            ],
          },
        },
        {
          businessId: existing.id,
          type: "gallery",
          enabled: false,
          sortOrder: 7,
          config: {
            title: "Наши работы",
            subtitle: "До / После",
            items: [],
          },
        },
        {
          businessId: existing.id,
          type: "vacancies",
          enabled: false,
          sortOrder: 8,
          config: {
            title: "Вакансии",
            items: [],
          },
        },
        {
          businessId: existing.id,
          type: "custom_html",
          enabled: false,
          sortOrder: 9,
          config: {
            html: "",
          },
        },
      ]);
      console.log("Added default page sections to existing demo business");
    }
    console.log("Demo business already exists:", slug);
    console.log("Salon owner: owner@uzbook.online / owner1234");
    console.log("Platform admin: admin@uzbook.online / admin1234");
    console.log("Support: support@uzbook.online / support1234");
    return;
  }

  const [ownerRow] = await db
    .select()
    .from(users)
    .where(eq(users.email, "owner@uzbook.online"))
    .limit(1);

  const [business] = await db
    .insert(businesses)
    .values({
      ownerId: ownerRow.id,
      slug,
      name: "Atelier Noir",
      category: "beauty",
      tagline: "Салон красоты в центре Ташкента",
      description:
        "Небольшой салон на три кресла: стрижки, окрашивание и уход. Работаем без спешки — один клиент в одно время.",
      city: "Ташкент",
      address: "ул. Шота Руставели, 12",
      phone: "+998 71 200 12 12",
      instagram: "atelier.noir",
      timezone: "Asia/Tashkent",
      currency: "UZS",
      status: "ACTIVE",
      plan: "PRO",
      settings: {
        slotStepMin: 15,
        leadTimeMin: 30,
        maxAdvanceDays: 60,
        cancellationHours: 3,
        autoConfirm: true,
        showPrices: true,
        requireEmail: false,
      },
      theme: { accent: "#7c5cff", mode: "light" },
    })
    .returning();

  await db.insert(subscriptions).values({
    businessId: business.id,
    plan: "PRO",
    status: "ACTIVE",
    provider: "MANUAL",
    amount: 199000,
    note: "Демо-аккаунт",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const serviceRows = await db
    .insert(services)
    .values([
      {
        businessId: business.id,
        name: "Женская стрижка",
        description: "Консультация, мытьё, стрижка и укладка.",
        category: "Волосы",
        durationMin: 60,
        price: 250000,
        bufferAfterMin: 10,
        sortOrder: 0,
      },
      {
        businessId: business.id,
        name: "Окрашивание в один тон",
        description: "Безаммиачный краситель, уход после окрашивания.",
        category: "Волосы",
        durationMin: 180,
        price: 900000,
        bufferAfterMin: 15,
        sortOrder: 1,
      },
      {
        businessId: business.id,
        name: "Уход за волосами",
        description: "Восстановление, спа-ритуал для волос.",
        category: "Волосы",
        durationMin: 45,
        price: 350000,
        bufferAfterMin: 10,
        sortOrder: 2,
      },
      {
        businessId: business.id,
        name: "Мужская стрижка",
        description: "Стрижка машинкой и ножницами, укладка.",
        category: "Барбер",
        durationMin: 45,
        price: 180000,
        bufferAfterMin: 10,
        sortOrder: 3,
      },
      {
        businessId: business.id,
        name: "Маникюр с покрытием",
        description: "Аппаратный маникюр, гель-лак, дизайн на выбор.",
        category: "Ногти",
        durationMin: 90,
        price: 220000,
        bufferAfterMin: 10,
        sortOrder: 4,
      },
    ])
    .returning();

  const staffRows = await db
    .insert(staff)
    .values([
      {
        businessId: business.id,
        name: "Мадина",
        title: "Колорист",
        bio: "12 лет с волосами. Люблю сложные блонды и здоровые волосы.",
        color: "#7c5cff",
        sortOrder: 0,
      },
      {
        businessId: business.id,
        name: "Тимур",
        title: "Барбер",
        bio: "Классические стрижки, борода, чёткие линии.",
        color: "#12b886",
        sortOrder: 1,
      },
      {
        businessId: business.id,
        name: "Азиза",
        title: "Мастер маникюра",
        bio: "Аппаратный маникюр и укрепление ногтей.",
        color: "#f5a524",
        sortOrder: 2,
      },
    ])
    .returning();

  const byName = (name: string) => serviceRows.find((s) => s.name === name)!.id;
  const staffByName = (name: string) => staffRows.find((s) => s.name === name)!.id;

  await db.insert(staffServices).values([
    { staffId: staffByName("Мадина"), serviceId: byName("Женская стрижка") },
    { staffId: staffByName("Мадина"), serviceId: byName("Окрашивание в один тон") },
    { staffId: staffByName("Мадина"), serviceId: byName("Уход за волосами") },
    { staffId: staffByName("Тимур"), serviceId: byName("Мужская стрижка") },
    { staffId: staffByName("Тимур"), serviceId: byName("Женская стрижка") },
    { staffId: staffByName("Азиза"), serviceId: byName("Маникюр с покрытием") },
  ]);

  await db.insert(workingHours).values(
    staffRows.flatMap((member) =>
      [1, 2, 3, 4, 5, 6].map((weekday) => ({
        staffId: member.id,
        weekday,
        startMinute: 10 * 60,
        endMinute: 20 * 60,
      })),
    ),
  );

  // Default page sections for the demo business
  await db.insert(pageSections).values([
    {
      businessId: business.id,
      type: "hero",
      enabled: true,
      sortOrder: 0,
      config: {
        showNearestSlot: true,
        ctaText: "Записаться онлайн",
      },
    },
    {
      businessId: business.id,
      type: "staff",
      enabled: true,
      sortOrder: 1,
      config: {
        title: "Мастера",
        subtitle: "Нажмите на мастера, чтобы увидеть свободное время",
        showBio: true,
        columns: 3,
      },
    },
    {
      businessId: business.id,
      type: "services",
      enabled: true,
      sortOrder: 2,
      config: {
        title: "Услуги",
        subtitle: "Прайс",
        groupByCategory: true,
        showPrices: true,
        showDuration: true,
      },
    },
    {
      businessId: business.id,
      type: "contacts",
      enabled: true,
      sortOrder: 3,
      config: {
        title: "Контакты",
        showAddress: true,
        showPhone: true,
        showInstagram: true,
        showMap: false,
      },
    },
    {
      businessId: business.id,
      type: "reviews",
      enabled: true,
      sortOrder: 4,
      config: {
        title: "Отзывы",
        subtitle: "Что говорят наши клиенты",
        items: [
          {
            name: "Дилноза",
            avatar: null,
            rating: 5,
            text: "Лучший салон в городе! Мастера настоящие профессионалы, всегда укладываются во время и результат превосходит ожидания.",
            date: "2026-09-15",
          },
          {
            name: "Руслан",
            avatar: null,
            rating: 5,
            text: "Тимур сделал отличную стрижку и укладку бороды. Атмосфера спокойная, цены адекватные. Теперь только сюда.",
            date: "2026-09-22",
          },
          {
            name: "Сабира",
            avatar: null,
            rating: 4,
            text: "Маникюр с Азизой прошёл на высоте. Дизайн получился именно таким, как хотела. Рекомендую!",
            date: "2026-10-01",
          },
        ],
      },
    },
    {
      businessId: business.id,
      type: "promotions",
      enabled: true,
      sortOrder: 5,
      config: {
        title: "Акции",
        subtitle: "Специальные предложения",
        items: [
          {
            title: "Первая стрижка -20%",
            description: "Скидка на любую стрижку при первом посещении",
            validUntil: "2026-12-31",
            serviceCategory: "Волосы",
          },
          {
            title: "Маникюр + педикюр",
            description: "При записи на маникюр и педикюр одновременно — скидка 15%",
            validUntil: "2026-12-31",
            serviceCategory: "Ногти",
          },
        ],
      },
    },
    {
      businessId: business.id,
      type: "faq",
      enabled: true,
      sortOrder: 6,
      config: {
        title: "Частые вопросы",
        items: [
          {
            question: "Как отменить или перенести запись?",
            answer: "После брони вы получите персональную ссылку (на странице и в Telegram). Перейдите по ней — там кнопки «Перенести» и «Отменить». Никаких звонков и логинов.",
          },
          {
            question: "Можно ли прийти без записи?",
            answer: "Лучше записаться заранее — так мы гарантируем время именно для вас. Но если мастер свободен, мы с радостью примем вас и без брони.",
          },
          {
            question: "Какие способы оплаты?",
            answer: "Наличные, карта, перевод по номеру телефона. Оплата после услуги.",
          },
          {
            question: "Есть ли парковка?",
            answer: "У салона небольшая парковка на 3 машины. Также рядом платная городская парковка.",
          },
        ],
      },
    },
    {
      businessId: business.id,
      type: "gallery",
      enabled: false,
      sortOrder: 7,
      config: {
        title: "Наши работы",
        subtitle: "До / После",
        items: [],
      },
    },
    {
      businessId: business.id,
      type: "vacancies",
      enabled: false,
      sortOrder: 8,
      config: {
        title: "Вакансии",
        items: [],
      },
    },
    {
      businessId: business.id,
      type: "custom_html",
      enabled: false,
      sortOrder: 9,
      config: {
        html: "",
      },
    },
  ]);

  // A few bookings for today so the timeline is not empty.
  const now = new Date();
  const tzOffset = 5 * 60 * 60 * 1000; // Asia/Tashkent, UTC+5
  const local = new Date(now.getTime() + tzOffset);
  const base = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0),
  );

  const at = (hour: number, minute = 0) =>
    new Date(base.getTime() + (hour * 60 + minute) * 60_000 - tzOffset);

  await db.insert(bookings).values([
    {
      businessId: business.id,
      staffId: staffByName("Мадина"),
      serviceId: byName("Окрашивание в один тон"),
      clientName: "Лола Ахмедова",
      clientPhone: "+998901112233",
      startAt: at(11, 0),
      endAt: at(14, 0),
      durationMin: 180,
      price: 900000,
      status: "CONFIRMED",
      source: "WEB",
      manageToken: "demo-token-lola-0001",
      note: "Хочет холодный блонд",
    },
    {
      businessId: business.id,
      staffId: staffByName("Тимур"),
      serviceId: byName("Мужская стрижка"),
      clientName: "Азиз Рахимов",
      clientPhone: "+998902223344",
      startAt: at(15, 0),
      endAt: at(15, 45),
      durationMin: 45,
      price: 180000,
      status: "CONFIRMED",
      source: "TELEGRAM",
      manageToken: "demo-token-aziz-0002",
    },
    {
      businessId: business.id,
      staffId: staffByName("Азиза"),
      serviceId: byName("Маникюр с покрытием"),
      clientName: "Камила Юсупова",
      clientPhone: "+998903334455",
      startAt: at(16, 30),
      endAt: at(18, 0),
      durationMin: 90,
      price: 220000,
      status: "PENDING",
      source: "WEB",
      manageToken: "demo-token-kamila-0003",
    },
  ]);

  console.log("Seeded demo business:", slug);
  console.log("Login: demo@uzbook.online / demo1234");
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
