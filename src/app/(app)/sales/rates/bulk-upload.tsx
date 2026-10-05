"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { marketForFile } from "@/lib/rate-sheet-match";
import { uploadRateSheet } from "./actions";

type Market = { id: string; name: string };
type Row = { file: string; market: string | null; status: string; ok?: boolean };

// Uploads one PDF per market in one go. Each file goes to the market its name mentions, one at a
// time so no single request gets too big.
export function BulkRateSheetUpload({ markets }: { markets: Market[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].map((f) => ({ f, m: marketForFile(f.name, markets) }));
    setRows(list.map(({ f, m }) => ({ file: f.name, market: m?.name ?? null, status: m ? "Waiting" : "No market in the file name, skipped" })));
    setBusy(true);
    for (const [i, { f, m }] of list.entries()) {
      if (!m) continue;
      const form = new FormData();
      form.set("file", f);
      let status = "Uploaded";
      let ok = true;
      try {
        const res = await uploadRateSheet(m.id, {}, form);
        if (res.error) [status, ok] = [res.error, false];
      } catch {
        [status, ok] = ["Couldn't upload, try again", false];
      }
      setRows((prev) => prev.map((r, j) => (j === i ? { ...r, status, ok } : r)));
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <details className="card mb-6 p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Upload rate sheets for several markets at once</summary>
      <p className="mt-2 text-slate-500">
        Pick all the PDFs together. Each one goes to the market named in its file name, for example &quot;Rate Sheet - El Paso.pdf&quot;, and replaces that market&apos;s current sheet.
      </p>
      <input type="file" multiple accept="application/pdf,.pdf" disabled={busy} className="mt-3" onChange={(e) => upload(e.target.files)} />
      {rows.length > 0 && (
        <table className="table mt-3">
          <tbody>
            {rows.map((r) => (
              <tr key={r.file}>
                <td>{r.file}</td>
                <td>{r.market ?? ""}</td>
                <td className={r.ok === false || !r.market ? "text-red-600" : r.ok ? "text-emerald-600" : "text-slate-500"}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
