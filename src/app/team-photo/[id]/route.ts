import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decodePhoto } from "@/lib/photos";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const user = await db.user.findFirst({ where: { id, companyId: viewer.companyId }, select: { photo: true } });
  const photo = user?.photo ? decodePhoto(user.photo) : null;
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
