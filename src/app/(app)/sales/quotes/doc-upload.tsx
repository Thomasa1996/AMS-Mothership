"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ACCEPTED_FILES } from "@/lib/file-upload";
import { addQuoteDoc } from "./doc-actions";

export function QuoteDocUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setNote(null);
    const errors: string[] = [];
    let added = 0;
    for (const f of [...files]) {
      const form = new FormData();
      form.set("file", f);
      try {
        const res = await addQuoteDoc({}, form);
        if (res.error) errors.push(res.error);
        else added++;
      } catch {
        errors.push(`${f.name} couldn't be uploaded. Try again.`);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    setNote(errors.length ? { ok: false, text: `${added ? `Added ${added}. ` : ""}${errors.join(" ")}` } : { ok: true, text: `Added ${added} ${added === 1 ? "file" : "files"}.` });
    router.refresh();
  }

  return (
    <div
      className="card flex flex-wrap items-center gap-3 border-dashed p-5"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy) upload(e.dataTransfer.files);
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">Add quotes</p>
        <p className="text-sm text-slate-500">Drag files here or pick them. Word, PDF, Excel and email files up to 4 MB each. They file themselves under this month.</p>
      </div>
      <label className={`btn btn-primary ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
        {busy ? "Uploading..." : "Choose files"}
        <input ref={input} type="file" multiple accept={ACCEPTED_FILES} className="hidden" disabled={busy} onChange={(e) => upload(e.target.files)} />
      </label>
      {note && <p className={`w-full text-sm ${note.ok ? "text-emerald-600" : "text-red-600"}`}>{note.text}</p>}
    </div>
  );
}
