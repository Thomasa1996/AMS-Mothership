// Power BI embed links. Accepts the link from File > Embed report > Website or portal (or the
// whole <iframe> snippet, a Publish to web link, or the report's address bar link) and returns a
// clean https embed URL, or null.

const POWER_BI_HOSTS = ["app.powerbi.com", "app.powerbigov.us", "app.high.powerbigov.us", "app.mil.powerbigov.us"];

export function parseEmbedUrl(input: string): string | null {
  const raw = input.trim();
  const fromIframe = /src\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1];
  let url: URL;
  try {
    url = new URL((fromIframe ?? raw).replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !POWER_BI_HOSTS.includes(url.hostname)) return null;
  // The address bar link while viewing a report (/groups/<workspace>/reports/<id>/<page>) is turned
  // into the matching secure embed link.
  const viewing = /^\/groups\/([^/]+)\/reports\/([0-9a-f-]{36})(?:\/([^/?]+))?/i.exec(url.pathname);
  if (viewing) {
    const [, group, reportId, page] = viewing;
    const embed = new URL(`https://${url.hostname}/reportEmbed`);
    embed.searchParams.set("reportId", reportId!);
    if (group && group.toLowerCase() !== "me") embed.searchParams.set("groupId", group);
    embed.searchParams.set("autoAuth", "true");
    const tenant = url.searchParams.get("ctid");
    if (tenant) embed.searchParams.set("ctid", tenant);
    if (page && page.toLowerCase() !== "reportsection") embed.searchParams.set("pageName", page);
    return embed.toString();
  }
  const path = url.pathname.toLowerCase();
  // reportEmbed is the secure embed (viewers sign in); /view is Publish to web.
  if (!path.startsWith("/reportembed") && !path.startsWith("/view")) return null;
  return url.toString();
}

export const isPublicLink = (url: string) => new URL(url).pathname.toLowerCase().startsWith("/view");
