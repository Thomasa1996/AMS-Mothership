import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { attachmentHeader } from "@/lib/file-upload";

// A file from the Marketing tab; everyone on the team can open it. ?view shows pictures and PDFs in
// the browser instead of downloading them.
const VIEWABLE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "video/mp4"]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const f = await db.marketingFile.findFirst({ where: { id, companyId: user.companyId } });
  if (!f) return new Response("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.has("view") && VIEWABLE.has(f.contentType);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.contentType,
      "Content-Disposition": attachmentHeader(f.fileName, inline),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
