import { ImageResponse } from "next/og";
import { pwaIconMarkup } from "@/lib/pwa/iconMarkup";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(pwaIconMarkup(180), { ...size });
}
