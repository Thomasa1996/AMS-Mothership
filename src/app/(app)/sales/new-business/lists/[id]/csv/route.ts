import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listScope } from "@/lib/prospect-lists";
import { crmStatus } from "../../../crm-status";

const cell = (v: string | null | undefined) => {
  const s = v ?? "";
  // Quote every cell, and stop spreadsheet apps reading a leading = + - @ as a formula.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { id } = await params;
  const list = await db.prospectList.findFirst({ where: { id, ...listScope(user) }, include: { items: { orderBy: { addedAt: "asc" } } } });
  if (!list) return new Response("Not found", { status: 404 });
  const status = await crmStatus(user, list.items.map((i) => i.apolloId));
  const rows = [
    ["Name", "Title", "Company", "Email", "In CRM"],
    ...list.items.map((i) => {
      const s = status.get(i.apolloId);
      return [s?.contactName ?? [i.firstName, i.lastName].filter(Boolean).join(" "), i.title, i.companyName, s?.email ?? "", s ? "Yes" : "No"];
    }),
  ];
  const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const file = list.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "prospects";
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"` },
  });
}
