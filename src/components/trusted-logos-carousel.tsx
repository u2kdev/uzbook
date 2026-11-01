import type { TrustedLogo } from "@/server/db/schema";

const FALLBACK_PARTNERS = [
  { id: "demo-1", name: "Atelier Noir", imageUrl: "" },
  { id: "demo-2", name: "Silk & Glow Studio", imageUrl: "" },
  { id: "demo-3", name: "Tashkent Barber Club", imageUrl: "" },
  { id: "demo-4", name: "Aura Beauty Lounge", imageUrl: "" },
  { id: "demo-5", name: "Royal Nails Tashkent", imageUrl: "" },
  { id: "demo-6", name: "DentaLux Clinic", imageUrl: "" },
];

export function TrustedLogosCarousel({ logos }: { logos: TrustedLogo[] }) {
  const hasUploadedLogos = logos.length > 0;
  const items = hasUploadedLogos
    ? logos.map((l) => ({
        id: l.id,
        name: l.name,
        imageUrl: l.imageUrl,
        linkUrl: l.linkUrl,
      }))
    : FALLBACK_PARTNERS.map((p) => ({ ...p, linkUrl: null }));

  // Duplicate list to create a seamless infinite loop (-50% translateX)
  const repeated = [...items, ...items, ...items];

  return (
    <section className="container-page py-8 sm:py-10">
      <div className="overflow-hidden rounded-[28px] border border-line/80 bg-white/80 py-6 shadow-soft backdrop-blur-sm">
        <div className="mb-5 px-6 text-center">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
            Нам доверяют лучшие салоны и студии
          </p>
        </div>

        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee flex items-center gap-6 px-3">
            {repeated.map((item, idx) => {
              const content = (
                <div className="group flex h-16 min-w-[180px] items-center justify-center gap-3 rounded-2xl border border-line/70 bg-paper/60 px-5 py-3 transition-all duration-300 hover:border-brand/40 hover:bg-white hover:shadow-xs">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="max-h-10 max-w-[130px] object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-ink-soft whitespace-nowrap">
                    {item.name}
                  </span>
                </div>
              );

              const isSafeLink =
                typeof item.linkUrl === "string" && /^https?:\/\/.+/i.test(item.linkUrl);

              return isSafeLink ? (
                <a
                  key={`${item.id}-${idx}`}
                  href={item.linkUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {content}
                </a>
              ) : (
                <div key={`${item.id}-${idx}`}>{content}</div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
