import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { quoteScope } from "@/lib/access";
import { safeFileName } from "@/lib/pdf-upload";

// The PDF of an uploaded quote, for anyone who can see the quote. ?download=1 saves it instead of
// showing it in the page.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const file = await db.quoteFile.findFirst({ where: { quoteId: id, quote: quoteScope(user) } });
  if (!file) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFileName(file.fileName)}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
