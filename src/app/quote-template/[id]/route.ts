import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { attachmentHeader } from "@/lib/file-upload";

// A quote template from Sales > Quote templates; everyone on the team can download them.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const t = await db.quoteTemplate.findFirst({ where: { id, companyId: user.companyId } });
  if (!t) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(t.data), {
    headers: { "Content-Type": t.contentType, "Content-Disposition": attachmentHeader(t.fileName), "Cache-Control": "private, no-cache" },
  });
}
