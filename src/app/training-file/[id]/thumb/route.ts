import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { toThumbnail } from "@/lib/thumbnail";
import { youTubeId } from "@/lib/youtube";

// The picture at the top of a Training card. A YouTube link gets its video's still the first time
// it's asked for (then saved). 404 means none, and the card shows a plain label.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const item = await db.trainingItem.findFirst({ where: { id, companyId: user.companyId }, select: { id: true, url: true, thumbnail: true } });
  if (!item) return new Response("Not found", { status: 404 });
  let thumb = item.thumbnail;
  const video = !thumb && item.url ? youTubeId(item.url) : null;
  if (video) {
    try {
      const res = await fetch(`https://img.youtube.com/vi/${video}/hqdefault.jpg`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) thumb = await toThumbnail(new Uint8Array(await res.arrayBuffer()), false);
    } catch {}
    if (thumb) await db.trainingItem.update({ where: { id: item.id }, data: { thumbnail: thumb } });
  }
  if (!thumb) return new Response("No preview", { status: 404 });
  return new Response(new Uint8Array(thumb), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" },
  });
}
