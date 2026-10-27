import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { uploadPath } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const filePath = uploadPath(name);
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  try {
    const file = await fs.readFile(filePath);
    const ext = name.split(".").pop()!.toLowerCase();
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
