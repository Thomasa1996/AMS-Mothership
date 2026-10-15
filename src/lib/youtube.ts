// The video id in a YouTube link (watch, youtu.be, shorts, embed or live), or null.
export function youTubeId(link: string): string | null {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
