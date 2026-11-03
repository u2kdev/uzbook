"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface Logo {
  name: string;
  id: string | number;
  img?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  src?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
}

export interface LogoColumnProps {
  logos: Logo[];
  index: number;
  currentTime: number;
}

const shuffleArray = <T,>(array: T[]): T[] => {
  if (array.length <= 1) return [...array];
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const distributeLogos = (allLogos: Logo[], columnCount: number): Logo[][] => {
  if (!allLogos || allLogos.length === 0) return [];
  const safeCols = Math.max(1, columnCount);
  const shuffled = shuffleArray(allLogos);
  const columns: Logo[][] = Array.from({ length: safeCols }, () => []);

  shuffled.forEach((logo, index) => {
    columns[index % safeCols].push(logo);
  });

  const maxLength = Math.max(...columns.map((col) => col.length));
  columns.forEach((col) => {
    if (col.length === 0) {
      col.push(shuffled[0]);
    }
    while (col.length < maxLength) {
      col.push(shuffled[Math.floor(Math.random() * shuffled.length)]);
    }
  });

  return columns;
};

export const LogoColumn: React.FC<LogoColumnProps> = React.memo(
  ({ logos, index, currentTime }) => {
    const cycleInterval = 2200;
    const columnDelay = index * 240;
    const totalTime = logos.length > 0 ? cycleInterval * logos.length : cycleInterval;
    const adjustedTime = (currentTime + columnDelay) % totalTime;
    const currentIndex = logos.length > 0 ? Math.floor(adjustedTime / cycleInterval) : 0;
    const currentItem = logos[currentIndex];

    const CurrentLogo = useMemo(() => currentItem?.img, [currentItem]);
    const imageSrc = currentItem?.src || currentItem?.imageUrl;
    const isSafeLink =
      typeof currentItem?.linkUrl === "string" &&
      /^https?:\/\/.+/i.test(currentItem.linkUrl);

    if (!currentItem) return null;

    const content = (
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentItem.id}-${currentIndex}`}
          className="absolute inset-0 flex flex-col items-center justify-center p-2"
          initial={{ y: "10%", opacity: 0, filter: "blur(8px)" }}
          animate={{
            y: "0%",
            opacity: 1,
            filter: "blur(0px)",
            transition: {
              type: "spring",
              stiffness: 300,
              damping: 20,
              mass: 1,
              bounce: 0.2,
              duration: 0.5,
            },
          }}
          exit={{
            y: "-20%",
            opacity: 0,
            filter: "blur(6px)",
            transition: {
              type: "tween",
              ease: "easeIn",
              duration: 0.3,
            },
          }}
        >
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={currentItem.name}
              loading="lazy"
              decoding="async"
              className="max-h-[75%] max-w-[85%] object-contain select-none transition-transform duration-300 group-hover:scale-105"
            />
          ) : CurrentLogo ? (
            <CurrentLogo className="h-10 w-10 max-h-[75%] max-w-[80%] object-contain text-ink select-none sm:h-12 sm:w-12" />
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand">
                {currentItem.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-[12px] font-semibold text-ink line-clamp-1">
                {currentItem.name}
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );

    return (
      <motion.div
        className="group relative h-16 w-32 overflow-hidden rounded-2xl border border-line/70 bg-paper/60 backdrop-blur-xs transition-all duration-300 hover:border-brand/40 hover:bg-white hover:shadow-xs sm:h-20 sm:w-44 md:h-24 md:w-52"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.1,
          duration: 0.5,
          ease: "easeOut",
        }}
      >
        {isSafeLink ? (
          <a
            href={currentItem.linkUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
          >
            {content}
          </a>
        ) : (
          content
        )}
      </motion.div>
    );
  }
);
LogoColumn.displayName = "LogoColumn";

export interface LogoCarouselProps {
  columnCount?: number;
  logos: Logo[];
  className?: string;
}

export function LogoCarousel({ columnCount = 2, logos, className = "" }: LogoCarouselProps) {
  const [logoSets, setLogoSets] = useState<Logo[][]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  const updateTime = useCallback(() => {
    setCurrentTime((prevTime) => prevTime + 100);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(updateTime, 100);
    return () => clearInterval(intervalId);
  }, [updateTime]);

  useEffect(() => {
    if (!logos || logos.length === 0) {
      setLogoSets([]);
      return;
    }
    const distributed = distributeLogos(logos, columnCount);
    setLogoSets(distributed);
  }, [logos, columnCount]);

  if (logoSets.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-5 ${className}`.trim()}
    >
      {logoSets.map((colLogos, index) => (
        <LogoColumn
          key={index}
          logos={colLogos}
          index={index}
          currentTime={currentTime}
        />
      ))}
    </div>
  );
}
