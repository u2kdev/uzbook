"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, Loader2, Printer, Share2 } from "lucide-react";
import { generateQRCodeToCanvas } from "@/lib/qr-code";

export function QRCodeDisplay({
  url,
  businessName,
  accent,
  size = 240,
}: {
  url: string;
  businessName: string;
  accent: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    async function draw() {
      if (!canvasRef.current) return;
      try {
        await generateQRCodeToCanvas(canvasRef.current, url, size, accent);
        if (alive) setReady(true);
      } catch {
        if (alive) setReady(true);
      }
    }
    draw();
    return () => {
      alive = false;
    };
  }, [url, size, accent]);

  async function canvasBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  async function copyImage() {
    try {
      const blob = await canvasBlob();
      if (blob && "ClipboardItem" in window) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }
    } catch {
      /* fall through to copying the link */
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${businessName.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function share() {
    if (typeof navigator.share !== "function") {
      await navigator.clipboard.writeText(url);
      return;
    }
    try {
      const blob = await canvasBlob();
      const file = blob
        ? new File([blob], `qr-${businessName}.png`, { type: "image/png" })
        : null;
      await navigator.share(
        file
          ? { title: `Запись в ${businessName}`, text: url, files: [file] }
          : { title: `Запись в ${businessName}`, text: url, url },
      );
    } catch {
      /* cancelled */
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function printPoster() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    const safeName = businessName.replace(/[<>&"]/g, "");
    const poster = window.open("", "_blank", "width=820,height=1080");
    if (!poster) return;

    poster.document.write(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>QR — ${safeName}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, Segoe UI, sans-serif; color: #0b0b10; background: #fff; }
    .sheet { width: 180mm; min-height: 240mm; margin: 10mm auto; padding: 18mm 14mm; text-align: center; }
    .kicker { font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #6b6b7b; }
    h1 { margin: 10px 0 4px; font-size: 34px; letter-spacing: -.02em; }
    .sub { margin: 0; font-size: 15px; color: #6b6b7b; }
    .qr { margin: 14mm auto 8mm; width: 88mm; height: 88mm; padding: 6mm; border: 1px solid #e7e7ee; border-radius: 8mm; }
    .qr img { width: 100%; height: 100%; display: block; }
    .action { font-size: 20px; font-weight: 600; }
    .hint { margin-top: 4mm; font-size: 13px; color: #6b6b7b; line-height: 1.5; }
    .link { margin-top: 10mm; font-size: 11px; color: #6b6b7b; word-break: break-all; }
    @page { size: A5 portrait; margin: 0; }
    @media print { .sheet { margin: 0; } body { print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="kicker">Онлайн-запись</p>
    <h1>${safeName}</h1>
    <p class="sub">Наведите камеру телефона на QR-код</p>
    <div class="qr"><img src="${data}" alt="QR-код" /></div>
    <p class="action">Выберите услугу и время</p>
    <p class="hint">Без звонков и переписки. Запись занимает меньше минуты,<br/>а напоминание придёт автоматически.</p>
    <p class="link">${url.replace(/[<>&"]/g, "")}</p>
  </div>
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`);
    poster.document.close();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="rounded-[20px] bg-white p-5 text-center ring-1 ring-line/80">
        <div className="relative inline-block rounded-2xl bg-white p-3 ring-1 ring-line">
          <canvas ref={canvasRef} width={size} height={size} className="mx-auto block" />
          {!ready && (
            <div className="absolute inset-3 grid place-items-center rounded-xl bg-paper">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          )}
        </div>
        <p className="mt-3 text-[11px] text-muted">Клиент наводит камеру — и сразу попадает на запись</p>
      </div>

      <div className="space-y-3">
        <div className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            Ссылка для клиентов
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5 ring-1 ring-line/70">
            <span className="truncate font-mono text-[11.5px] text-ink-soft">{url}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="btn btn-ghost h-10 px-4 text-[12px]">
              {linkCopied ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
              {linkCopied ? "Ссылка скопирована" : "Копировать ссылку"}
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 px-4 text-[12px]">
              <ExternalLink size={14} /> Открыть
            </a>
          </div>
        </div>

        <div className="rounded-[20px] bg-white p-5 ring-1 ring-line/80">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">
            QR-код
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Распечатайте и повесьте у входа, на стойке администратора или на зеркале. Клиенту
            не нужно искать вас в Instagram — достаточно навести камеру.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={copyImage} className="btn btn-ghost h-10 px-4 text-[12px]">
              {copied ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
              {copied ? "Скопировано" : "Копировать QR"}
            </button>
            <button type="button" onClick={download} className="btn btn-ghost h-10 px-4 text-[12px]">
              <Download size={14} /> Скачать PNG
            </button>
            <button type="button" onClick={printPoster} className="btn btn-ghost h-10 px-4 text-[12px]">
              <Printer size={14} /> Табличка на печать
            </button>
            <button type="button" onClick={share} className="btn btn-ghost h-10 px-4 text-[12px]">
              <Share2 size={14} /> Поделиться
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
