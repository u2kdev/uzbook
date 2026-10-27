"use client";

import { useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Eye,
  GripVertical,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { GalleryImage } from "@/server/db/schema";
import {
  deleteGalleryImageAction,
  listGalleryImages,
  reorderGalleryAction,
  updateGalleryCaptionAction,
  uploadGalleryImageAction,
} from "@/server/actions/gallery";

function SortablePhoto({
  image,
  onDelete,
  onCaption,
  onPreview,
}: {
  image: GalleryImage;
  onDelete: (id: string) => void;
  onCaption: (id: string, caption: string) => void;
  onPreview: (image: GalleryImage) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(image.caption ?? "");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative overflow-hidden rounded-2xl bg-white ring-1 ring-line/80 ${
        isDragging ? "z-10 shadow-lift ring-2 ring-brand/40" : ""
      }`}
    >
      <div className="relative aspect-[4/3] bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.caption ?? "Работа"} className="size-full object-cover" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1 bg-gradient-to-b from-black/45 to-transparent p-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="grid size-7 cursor-grab place-items-center rounded-lg bg-white/90 text-ink active:cursor-grabbing"
            aria-label="Перетащить фото"
          >
            <GripVertical size={13} strokeWidth={1.8} />
          </button>
          <div className="flex gap-1">
            {image.beforeUrl && (
              <button
                type="button"
                onClick={() => onPreview(image)}
                className="grid size-7 place-items-center rounded-lg bg-white/90 text-ink"
                title="Показать «до»"
              >
                <Eye size={13} strokeWidth={1.8} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(image.id)}
              className="grid size-7 place-items-center rounded-lg bg-white/90 text-rose"
              title="Удалить"
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </button>
          </div>
        </div>
        {image.beforeUrl && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-semibold text-ink">
            до / после
          </span>
        )}
      </div>

      <div className="p-2.5">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={caption}
              maxLength={160}
              onChange={(event) => setCaption(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onCaption(image.id, caption);
                  setEditing(false);
                }
                if (event.key === "Escape") setEditing(false);
              }}
              className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-[11.5px] outline-none focus:border-brand"
              placeholder="Подпись"
            />
            <button
              type="button"
              onClick={() => {
                onCaption(image.id, caption);
                setEditing(false);
              }}
              className="grid size-6 place-items-center rounded-md bg-mint/10 text-mint"
              aria-label="Сохранить"
            >
              <Check size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center gap-1.5 text-left text-[11.5px] text-ink-soft"
          >
            <span className="min-w-0 flex-1 truncate">
              {image.caption || "Добавить подпись"}
            </span>
            <Pencil size={11} className="shrink-0 text-muted/60" />
          </button>
        )}
      </div>
    </div>
  );
}

export function GalleryManager({
  initialImages,
  galleryEnabled,
}: {
  initialImages: GalleryImage[];
  galleryEnabled: boolean;
}) {
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GalleryImage | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [before, setBefore] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function reload() {
    const rows = await listGalleryImages();
    setImages(rows);
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!after) {
      setError("Выберите фото работы");
      return;
    }
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("after", after);
    if (before) formData.append("before", before);
    formData.append("caption", caption);

    const result = await uploadGalleryImageAction(formData);
    setUploading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setAfter(null);
    setBefore(null);
    setCaption("");
    formRef.current?.reset();
    await reload();
  }

  function remove(id: string) {
    if (!confirm("Удалить это фото? Оно исчезнет со страницы.")) return;
    setImages((current) => current.filter((image) => image.id !== id));
    startTransition(async () => {
      await deleteGalleryImageAction(id);
      await reload();
    });
  }

  function changeCaption(id: string, value: string) {
    setImages((current) =>
      current.map((image) => (image.id === id ? { ...image, caption: value } : image)),
    );
    startTransition(async () => {
      await updateGalleryCaptionAction(id, value);
    });
  }

  function dragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((image) => image.id === active.id);
    const newIndex = images.findIndex((image) => image.id === over.id);
    const next = arrayMove(images, oldIndex, newIndex);
    setImages(next);
    startTransition(async () => {
      await reorderGalleryAction(next.map((image) => image.id));
    });
  }

  return (
    <div className="space-y-4">
      {!galleryEnabled && (
        <div className="rounded-2xl border border-amber/25 bg-amber/5 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          Блок «Галерея» выключен на странице. Включите его во вкладке{" "}
          <b>«Блоки страницы»</b> — фото сразу появятся на лендинге.
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={upload}
        className="rounded-[20px] bg-white p-5 ring-1 ring-line/80"
      >
        <div className="flex items-center gap-2">
          <ImageIcon size={16} strokeWidth={1.6} className="text-muted" />
          <p className="text-[14px] font-semibold">Добавить работу</p>
        </div>
        <p className="mt-1 text-[12px] text-muted">
          Загрузите фото «после» — и, если есть, фото «до». JPG, PNG или WebP до 5 МБ.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-base">Фото «после» *</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setAfter(event.target.files?.[0] ?? null)}
              className="input-base file:mr-3 file:rounded-full file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-brand-dark"
            />
          </label>
          <label className="block">
            <span className="label-base">Фото «до» (необязательно)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => setBefore(event.target.files?.[0] ?? null)}
              className="input-base file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-ink-soft"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label-base">Подпись</span>
            <input
              type="text"
              value={caption}
              maxLength={160}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Например: блонд на тёмные волосы, 3 часа"
              className="input-base"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose/20 bg-rose/5 px-3 py-2 text-[12px] text-rose">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="btn btn-primary mt-4 h-10 px-5 text-[12.5px]"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {uploading ? "Загружаем…" : "Добавить в галерею"}
        </button>
      </form>

      {images.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line bg-white/60 px-6 py-12 text-center">
          <ImageIcon size={30} className="mx-auto text-muted/40" />
          <p className="mt-3 text-[14px] font-semibold">Пока нет фотографий</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
            Добавьте 3–6 лучших работ. Клиенты доверяют больше, когда видят результат.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[12px] text-muted">
              {images.length} фото · перетаскивайте, чтобы изменить порядок
            </p>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
            <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((image) => (
                  <SortablePhoto
                    key={image.id}
                    image={image}
                    onDelete={remove}
                    onCaption={changeCaption}
                    onPreview={setPreview}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-[24px] bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute top-3 right-3 z-10 grid size-8 place-items-center rounded-lg bg-white/90"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
            <div className="grid grid-cols-2">
              {preview.beforeUrl && (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.beforeUrl} alt="До" className="aspect-[4/3] w-full object-cover" />
                  <p className="bg-paper py-2 text-center text-[11px] font-semibold text-muted">ДО</p>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt="После" className="aspect-[4/3] w-full object-cover" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
