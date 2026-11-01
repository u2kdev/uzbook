"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Trash2, Upload } from "lucide-react";
import type { TrustedLogo } from "@/server/db/schema";
import {
  deleteTrustedLogoAction,
  toggleTrustedLogoAction,
  uploadTrustedLogoAction,
  type LogoActionState,
} from "@/server/actions/logos";
import { TrustedLogosCarousel } from "@/components/trusted-logos-carousel";

export function LogoManager({
  canManage,
  initialLogos,
}: {
  canManage: boolean;
  initialLogos: TrustedLogo[];
}) {
  const router = useRouter();
  const [state, uploadAction, uploadPending] = useActionState<LogoActionState, FormData>(
    uploadTrustedLogoAction,
    null,
  );
  const [isMutating, startTransition] = useTransition();

  const activeLogos = initialLogos.filter((l) => l.enabled);

  return (
    <div className="space-y-6">
      {/* Live Carousel Preview */}
      <div className="rounded-[24px] border border-line bg-white p-4 sm:p-5">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
          Живой предпросмотр крутящейся карусели (как на главной странице):
        </p>
        <TrustedLogosCarousel logos={activeLogos} />
      </div>

      {/* Upload PNG Form */}
      {canManage && (
        <div className="rounded-[24px] border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Upload size={17} className="text-brand" />
            <h2 className="text-[16px] font-semibold">
              Добавить PNG-логотип в карусель «Нам доверяют»
            </h2>
          </div>
          <p className="mt-1 text-[12px] text-muted">
            Загрузите файл логотипа в формате <b>.PNG</b> (рекомендуется с прозрачным фоном) или
            укажите прямую ссылку.
          </p>

          <form action={uploadAction} className="mt-4 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label-base">Название компании / салона *</label>
              <input
                name="name"
                required
                placeholder="Atelier Noir"
                className="input-base"
              />
            </div>

            <div>
              <label className="label-base">Файл логотипа (.PNG / .WEBP) *</label>
              <input
                name="file"
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="input-base py-2.5 text-[12px]"
              />
            </div>

            <div>
              <label className="label-base">Или прямая ссылка на PNG</label>
              <input
                name="imageUrl"
                type="text"
                placeholder="https://.../logo.png"
                className="input-base"
              />
            </div>

            <div>
              <label className="label-base">Ссылка при клике (необязательно)</label>
              <input
                name="linkUrl"
                type="text"
                placeholder="https://uzbook.online/atelier-noir"
                className="input-base"
              />
            </div>

            {state?.error && (
              <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-rose/20 bg-rose/5 px-3.5 py-2.5 text-[12.5px] text-rose">
                {state.error}
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={uploadPending}
                className="btn btn-primary h-10 gap-1.5 px-5 text-[12.5px]"
              >
                <Plus size={15} />
                {uploadPending ? "Загружаем..." : "Добавить логотип в карусель"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Logos Grid */}
      <div className="space-y-3">
        <h2 className="px-1 text-[15px] font-semibold">
          Загруженные логотипы ({initialLogos.length})
        </h2>

        {initialLogos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-[12.5px] text-muted">
            Вы ещё не загрузили собственные PNG-логотипы (сейчас на главной крутятся демонстрационные карточки). Добавьте первый логотип выше!
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {initialLogos.map((logo) => (
              <div
                key={logo.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${
                  logo.enabled
                    ? "border-line bg-white"
                    : "border-line/60 bg-paper/60 opacity-70"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-12 w-16 shrink-0 place-items-center rounded-xl border border-line bg-paper p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.imageUrl}
                      alt={logo.name}
                      className="max-h-9 max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{logo.name}</p>
                    <p className="text-[11px] text-muted">
                      {logo.enabled ? "Крутится на главной" : "Скрыт"}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        startTransition(async () => {
                          await toggleTrustedLogoAction(logo.id, !logo.enabled);
                          router.refresh();
                        });
                      }}
                      className="grid size-8 place-items-center rounded-lg border border-line bg-paper text-ink hover:bg-white"
                      title={logo.enabled ? "Скрыть" : "Показать"}
                    >
                      {logo.enabled ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        startTransition(async () => {
                          await deleteTrustedLogoAction(logo.id);
                          router.refresh();
                        });
                      }}
                      className="grid size-8 place-items-center rounded-lg border border-rose/20 bg-rose/5 text-rose hover:bg-rose/10"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
