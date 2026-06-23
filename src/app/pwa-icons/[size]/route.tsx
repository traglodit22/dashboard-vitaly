import { ImageResponse } from "next/og";
import { pwaIconMarkup } from "@/lib/pwa/iconMarkup";

export const runtime = "edge";

function parseSize(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 192;
  return Math.min(512, Math.max(32, n));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await context.params;
  const size = parseSize(sizeParam);

  return new ImageResponse(pwaIconMarkup(size), {
    width: size,
    height: size,
  });
}
