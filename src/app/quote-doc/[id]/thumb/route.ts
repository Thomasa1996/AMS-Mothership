import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { limitedToOwn } from "@/lib/access";
import { makeThumbnail, serverCanPreview } from "@/lib/thumbnail";

// The preview beside a quote file in Sales > Quotes, for whoever can open the file. Pictures and Office
// files added before previews existed get theirs made (and saved) the first time it's asked for. 404 means none.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const doc = await db.quoteDoc.findFirst({
    where: { id, companyId: user.companyId, ...(limitedToOwn(user) ? { ownerId: user.id } : {}) },
    select: { id: true, fileName: true, contentType: true, thumbnail: true },
  });
  if (!doc) return new Response("Not found", { status: 404 });
  let thumb = doc.thumbnail;
  if (!thumb && serverCanPreview(doc.fileName, doc.contentType)) {
    const full = await db.quoteDoc.findUniqueOrThrow({ where: { id: doc.id }, select: { data: true } });
    thumb = await makeThumbnail(doc.fileName, doc.contentType, full.data);
    if (thumb) await db.quoteDoc.update({ where: { id: doc.id }, data: { thumbnail: thumb } });
  }
  if (!thumb) return new Response("No preview", { status: 404 });
  return new Response(new Uint8Array(thumb), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" },
  });
}
