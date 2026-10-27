"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function CopyLink({
  url,
  label = "Ссылка на запись",
  compact = false,
}: {
  url: string;
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  }

  if (compact) {
    return (
      <button onClick={copy} className="btn btn-ghost h-10 gap-2 text-[12.5px]">
        {copied ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
        {copied ? "Скопировано" : "Скопировать ссылку"}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{label}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2.5 py-2 text-[12px]">
          {url}
        </code>
        <button
          onClick={copy}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-ink/20 hover:text-ink"
          title="Скопировать"
        >
          {copied ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-ink/20 hover:text-ink"
          title="Открыть"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
