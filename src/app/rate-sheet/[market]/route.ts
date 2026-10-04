import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Downloads a market's PDF rate sheet. Anyone signed in to the company can download.
export async function GET(_req: Request, { params }: { params: Promise<{ market: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { market } = await params;
  const sheet = await db.rateSheet.findUnique({ where: { companyId_market: { companyId: user.companyId, market } } });
  if (!sheet) return new Response("Not found", { status: 404 });
  const name = sheet.fileName.replace(/[^\w .()-]/g, "_");
  return new Response(new Uint8Array(sheet.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
