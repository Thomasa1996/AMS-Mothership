import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { limitedToOwn } from "@/lib/access";
import { attachmentHeader } from "@/lib/file-upload";

// A quote file from Sales > Quotes, for its rep or anyone who can see every rep's files.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const doc = await db.quoteDoc.findFirst({ where: { id, companyId: user.companyId, ...(limitedToOwn(user) ? { ownerId: user.id } : {}) } });
  if (!doc) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": attachmentHeader(doc.fileName, doc.contentType === "application/pdf"),
      "Cache-Control": "private, no-cache",
    },
  });
}
