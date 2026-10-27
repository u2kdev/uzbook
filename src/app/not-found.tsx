import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-5 text-center">
      <Logo />
      <p className="mt-10 text-[10.5px] font-semibold tracking-[0.18em] text-muted uppercase">
        404
      </p>
      <h1 className="mt-3 max-w-md text-[clamp(1.8rem,4vw,2.6rem)] leading-tight font-semibold">
        Такой страницы нет
      </h1>
      <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted">
        Возможно, ссылка устарела или салон сменил адрес. Попросите актуальную ссылку у салона.
      </p>
      <Link href="/" className="btn btn-primary mt-7">
        На главную
      </Link>
    </div>
  );
}
