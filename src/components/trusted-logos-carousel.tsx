"use client";

import React from "react";
import type { TrustedLogo } from "@/server/db/schema";
import { LogoCarousel, type Logo } from "@/components/ui/logo-carousel";
import { GradientHeading } from "@/components/ui/gradient-heading";

const FALLBACK_LOGOS: Logo[] = [
  { id: "fallback-1", name: "Atelier Noir", imageUrl: "" },
  { id: "fallback-2", name: "Silk & Glow Studio", imageUrl: "" },
  { id: "fallback-3", name: "Tashkent Barber Club", imageUrl: "" },
  { id: "fallback-4", name: "Aura Beauty Lounge", imageUrl: "" },
  { id: "fallback-5", name: "Royal Nails Tashkent", imageUrl: "" },
  { id: "fallback-6", name: "DentaLux Clinic", imageUrl: "" },
  { id: "fallback-7", name: "Lumière Esthetics", imageUrl: "" },
  { id: "fallback-8", name: "Prime Cuts & Shave", imageUrl: "" },
];

export function TrustedLogosCarousel({ logos }: { logos: TrustedLogo[] }) {
  const hasUploadedLogos = Array.isArray(logos) && logos.length > 0;

  const carouselLogos: Logo[] = hasUploadedLogos
    ? logos.map((l) => ({
        id: l.id,
        name: l.name,
        imageUrl: l.imageUrl,
        src: l.imageUrl,
        linkUrl: l.linkUrl,
      }))
    : FALLBACK_LOGOS;

  return (
    <section className="container-page py-10 sm:py-14">
      <div className="overflow-hidden rounded-[32px] border border-line/80 bg-white/80 p-6 shadow-soft backdrop-blur-md sm:p-10">
        <div className="mb-8 text-center space-y-2">
          <GradientHeading variant="secondary">
            Нам доверяют лидеры индустрии
          </GradientHeading>
          <GradientHeading size="sm" as="h3" className="text-ink">
            Ведущие салоны, студии и барбершопы на платформе UzBook
          </GradientHeading>
        </div>

        <div className="flex justify-center">
          <LogoCarousel columnCount={4} logos={carouselLogos} />
        </div>
      </div>
    </section>
  );
}
