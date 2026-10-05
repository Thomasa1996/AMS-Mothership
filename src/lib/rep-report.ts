// A sales rep's own report link, pasted by an admin on Revenue > Sales reps. Accepts a SharePoint or
// OneDrive link (or the <iframe> embed code Excel and PowerPoint give), or any Power BI link.
import { parseEmbedUrl } from "./powerbi";

const MICROSOFT_HOST = /(^|\.)(sharepoint\.com|sharepoint\.us|sharepoint-mil\.us|onedrive\.live\.com|1drv\.ms)$/i;

export function parseRepReportUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const powerBi = parseEmbedUrl(raw);
  if (powerBi) return powerBi;
  const fromIframe = /src\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1];
  let url: URL;
  try {
    url = new URL((fromIframe ?? raw).replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !MICROSOFT_HOST.test(url.hostname)) return null;
  return url.toString();
}

// Power BI embed links and SharePoint/OneDrive "embed" links can show inside Mothership. Ordinary
// sharing links can't (Microsoft blocks them in other sites), so those open in a new tab instead.
export function canEmbed(url: string) {
  const u = new URL(url);
  if (parseEmbedUrl(url)) return true;
  return u.searchParams.get("action")?.toLowerCase() === "embedview" || /\/embed(\?|$)/i.test(u.pathname) || u.pathname.toLowerCase().includes("/_layouts/15/embed.aspx");
}
