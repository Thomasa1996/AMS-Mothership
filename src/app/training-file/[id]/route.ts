import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { safeFileName } from "@/lib/pdf-upload";

// Opens a training PDF in the browser. Anyone signed in to the company can view.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const item = await db.trainingItem.findFirst({ where: { id, companyId: user.companyId }, select: { fileName: true, file: { select: { data: true } } } });
  if (!item?.file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(item.file.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName(item.fileName ?? "training.pdf")}"`,
      "Cache-Control": "private, no-cache",
    },
  });
}
