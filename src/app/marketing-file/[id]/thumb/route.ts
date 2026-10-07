import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeThumbnail, serverCanPreview } from "@/lib/thumbnail";

// The card preview for a Marketing file. Pictures and Office files added before previews existed get
// theirs made (and saved) the first time it's asked for. 404 means there is no preview.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const f = await db.marketingFile.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, fileName: true, contentType: true, thumbnail: true },
  });
  if (!f) return new Response("Not found", { status: 404 });
  let thumb = f.thumbnail;
  if (!thumb && serverCanPreview(f.fileName, f.contentType)) {
    const full = await db.marketingFile.findUniqueOrThrow({ where: { id: f.id }, select: { data: true } });
    thumb = await makeThumbnail(f.fileName, f.contentType, full.data);
    if (thumb) await db.marketingFile.update({ where: { id: f.id }, data: { thumbnail: thumb } });
  }
  if (!thumb) return new Response("No preview", { status: 404 });
  return new Response(new Uint8Array(thumb), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
