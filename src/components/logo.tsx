import Link from "next/link";

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-[11px] bg-ink text-white shadow-[0_10px_24px_-14px_rgba(11,11,16,0.9)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-rotate-6">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7 4.5v6.25a5 5 0 0 0 10 0V4.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <circle cx="17" cy="6" r="1.9" fill="#8f7bff" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-[-0.03em]">
          uzbook<span className="text-brand">.</span>
        </span>
      )}
    </Link>
  );
}
