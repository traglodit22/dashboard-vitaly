import { query } from "@/lib/db/index";

export const PWA_THEME_COLOR = "#2563eb";
export const PWA_BACKGROUND_COLOR = "#09090b";
export const DEFAULT_APP_NAME = "Dashboard";

export async function getPwaSettings() {
  try {
    const rows = await query<Record<string, unknown>>(
      "SELECT site_title FROM system_settings WHERE id=1",
    );
    const title = (rows[0]?.site_title as string | undefined)?.trim() || DEFAULT_APP_NAME;
    const shortName = title.length > 14 ? `${title.slice(0, 13).trim()}…` : title;
    return { name: title, shortName };
  } catch {
    return { name: DEFAULT_APP_NAME, shortName: DEFAULT_APP_NAME };
  }
}
