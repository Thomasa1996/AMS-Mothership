import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decodePhoto } from "@/lib/photos";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  if (id !== viewer.id) return new Response("Not found", { status: 404 });
  const user = await db.user.findFirst({ where: { id: viewer.id }, select: { background: true } });
  const image = user?.background ? decodePhoto(user.background) : null;
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
