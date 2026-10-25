import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { signedDocScope } from "@/lib/access";
import { attachmentHeader } from "@/lib/file-upload";

// A PDF signed on Sales > Sign documents. Saved as a download; ?view=1 opens it in the browser instead.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const doc = await db.signedDocument.findFirst({ where: { id, ...signedDocScope(user) } });
  if (!doc) return new Response("Not found", { status: 404 });
  const view = new URL(req.url).searchParams.has("view");
  return new Response(new Uint8Array(doc.data), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": attachmentHeader(doc.fileName, view), "Cache-Control": "private, no-cache" },
  });
}
