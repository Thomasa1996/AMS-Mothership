"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readMissingDetails } from "./doc-actions";

// Shown while some files were added before Mothership read their totals and dates: reads them as
// soon as the page opens, a batch at a time, then refreshes the list.
export function ReadDetails({ count }: { count: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(count);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      let remaining = count;
      for (let round = 0; round < 20 && remaining > 0; round++) {
        try {
          const next = await readMissingDetails();
          if (next >= remaining && round > 0) break;
          remaining = next;
          setLeft(next);
        } catch {
          setFailed(true);
          break;
        }
      }
      router.refresh();
    })();
  }, [count, router]);

  if (failed) return <p className="text-sm text-amber-700">Couldn&apos;t read some earlier files. Reload to try again.</p>;
  if (!left) return null;
  return <p className="text-sm text-slate-500">Reading totals and dates from {left} earlier {left === 1 ? "file" : "files"}...</p>;
}
