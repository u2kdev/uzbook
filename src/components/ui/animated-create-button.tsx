"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const CATEGORIES = [
  "салона",
  "барбершопа",
  "студии красоты",
  "мастера",
  "стоматологии",
  "клиники",
];

interface AnimatedCreateButtonProps {
  variant?: "hero" | "header" | "cta" | "pricing";
  href?: string;
  className?: string;
  label?: string;
}

export function AnimatedCreateButton({
  variant = "hero",
  href = "/register",
  className = "",
  label,
}: AnimatedCreateButtonProps) {
  const [catIndex, setCatIndex] = useState(0);

  useEffect(() => {
    if (variant !== "hero") return;
    const interval = setInterval(() => {
      setCatIndex((prev) => (prev + 1) % CATEGORIES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [variant]);

  if (variant === "header") {
    return (
      <Link href={href} className="group relative inline-block">
        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-brand/60 to-accent/60 opacity-0 blur-xs transition duration-300 group-hover:opacity-100" />
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={`relative inline-flex h-9 items-center justify-center overflow-hidden rounded-full bg-ink px-3.5 text-[13px] font-medium text-white shadow-sm transition-all duration-300 hover:bg-[#1d1d27] hover:shadow-[0_8px_20px_-8px_rgba(11,11,16,0.6)] sm:h-10 sm:px-4 ${className}`.trim()}
        >
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
          <span className="hidden sm:inline">Создать страницу</span>
          <span className="sm:hidden">Создать</span>
        </motion.div>
      </Link>
    );
  }

  if (variant === "cta") {
    return (
      <Link href={href} className="group relative inline-block">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-white/40 via-white/80 to-white/40 opacity-0 blur-md transition duration-500 group-hover:opacity-75" />
        <motion.div
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 350, damping: 22 }}
          className={`relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-full bg-white px-3 pl-6 text-[14px] font-semibold text-ink shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] transition-all duration-300 ${className}`.trim()}
        >
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-ink/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
          <span>{label || "Создать страницу"}</span>
          <span className="grid size-8 place-items-center rounded-full bg-ink/8 text-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5 group-hover:bg-ink group-hover:text-white">
            <ArrowUpRight size={16} strokeWidth={1.8} />
          </span>
        </motion.div>
      </Link>
    );
  }

  // Default: "hero" variant
  return (
    <Link href={href} className="group relative inline-block">
      {/* Ambient background glow */}
      <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-brand via-accent to-brand opacity-0 blur-md transition duration-500 group-hover:opacity-70" />

      <motion.div
        whileHover={{ scale: 1.025 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
        className={`relative inline-flex h-12 items-center gap-3 overflow-hidden rounded-full bg-ink px-3 pl-6 text-[14px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(11,11,16,0.55)] transition-all duration-300 hover:bg-[#1d1d27] sm:h-13 sm:text-[14.5px] ${className}`.trim()}
      >
        {/* Shimmer light beam effect */}
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full" />

        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>Создать страницу</span>
          <span className="relative inline-flex h-6 min-w-[95px] items-center overflow-hidden sm:min-w-[110px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={catIndex}
                initial={{ y: "40%", opacity: 0, filter: "blur(4px)" }}
                animate={{
                  y: "0%",
                  opacity: 1,
                  filter: "blur(0px)",
                  transition: {
                    type: "spring",
                    stiffness: 320,
                    damping: 22,
                    mass: 0.8,
                  },
                }}
                exit={{
                  y: "-40%",
                  opacity: 0,
                  filter: "blur(4px)",
                  transition: { duration: 0.2, ease: "easeIn" },
                }}
                className="absolute left-0 text-brand-light font-medium"
              >
                {CATEGORIES[catIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        {/* Circular icon action badge with spring translation */}
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12 text-white transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:text-ink">
          <ArrowUpRight size={16} strokeWidth={1.8} />
        </span>
      </motion.div>
    </Link>
  );
}
