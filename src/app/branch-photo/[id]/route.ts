import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// A market's city photo, for anyone signed in to the company. The page adds ?v=<photoAt> so a new
// photo isn't hidden by the browser cache.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const photo = await db.branchPhoto.findFirst({ where: { branchId: id, branch: { companyId: user.companyId } } });
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
