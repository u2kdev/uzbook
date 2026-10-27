"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Logo } from "@/components/logo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-5 text-center">
      <Logo />
      <div className="mt-8 grid size-14 place-items-center rounded-2xl bg-rose/10 text-rose">
        <AlertCircle size={28} strokeWidth={1.7} />
      </div>
      <h1 className="mt-4 max-w-md text-[26px] leading-tight font-semibold tracking-[-0.02em]">
        Что-то пошло не так
      </h1>
      <p className="mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-muted">
        Произошла неожиданная ошибка при загрузке. Попробуйте обновить страницу или вернуться позже.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button onClick={() => reset()} className="btn btn-primary">
          <RotateCcw size={15} /> Попробовать снова
        </button>
        <Link href="/" className="btn btn-ghost">
          На главную
        </Link>
      </div>
    </div>
  );
}
