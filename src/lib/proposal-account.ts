// Works out which CRM account (the client) a proposal is for. An email domain is the surest sign:
// the address it was sent to, or one written in the file, matched against the account's website and
// its contacts' emails. Failing that, the account whose name the file mentions most (the longest
// name wins a tie, so "Meridian Health Partners" beats "Meridian").

export type AccountNames = { id: string; name: string; website: string | null; emails: string[] };

// Free mail and our own addresses say nothing about which client it is.
const PERSONAL = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "live.com", "msn.com", "me.com", "comcast.net", "att.net", "verizon.net"]);

// Words that don't tell one company from another.
const FILLER = new Set(["inc", "llc", "ltd", "co", "corp", "corporation", "company", "the", "group", "lp", "llp", "pllc", "pc", "of", "and"]);

const words = (s: string) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

// "Meridian Health Partners, LLC" -> "meridian health partners". Too short or too common to trust -> "".
export function accountKey(name: string) {
  const w = words(name).filter((x) => !FILLER.has(x));
  const key = w.join(" ");
  return key.length >= 4 && (w.length > 1 || key.length >= 5) ? key : "";
}

// "https://www.meridianhealth.com/about" or "jw@meridianhealth.com" -> "meridianhealth.com".
export function domainOf(s: string | null | undefined) {
  if (!s) return "";
  const t = s.trim().toLowerCase();
  const host = t.includes("@") ? t.split("@").pop()! : t.replace(/^[a-z]+:\/\//, "").split(/[/?#:]/)[0];
  return host.replace(/^www\./, "").replace(/[^a-z0-9.-]/g, "");
}

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;
const WEB = /\b(?:https?:\/\/)?(?:www\.)([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;

export function findAccount<T extends AccountNames>(input: { to?: string[]; text: string }, accounts: T[], ownDomains: string[] = []): T | null {
  const skip = new Set([...PERSONAL, ...ownDomains.map(domainOf)]);
  const byDomain = new Map<string, T | null>();
  for (const a of accounts) {
    for (const d of new Set([domainOf(a.website), ...a.emails.map(domainOf)])) {
      if (!d || skip.has(d)) continue;
      // A domain two accounts share can't pick between them.
      byDomain.set(d, byDomain.has(d) && byDomain.get(d)?.id !== a.id ? null : a);
    }
  }
  const textDomains = [...input.text.matchAll(EMAIL)].map((m) => m[1]).concat([...input.text.matchAll(WEB)].map((m) => m[1]));
  for (const d of [...(input.to ?? []), ...textDomains].map(domainOf)) {
    const hit = byDomain.get(d);
    if (hit) return hit;
  }

  const byName = new Map<string, T | null>();
  for (const a of accounts) {
    const k = accountKey(a.name);
    if (k) byName.set(k, byName.has(k) && byName.get(k)?.id !== a.id ? null : a);
  }
  // Look up every run of up to 6 words in the text, so thousands of accounts cost no more than a few.
  const w = words(input.text);
  const counts = new Map<T, { n: number; len: number }>();
  // At each spot only the longest name counts, so "Meridian" inside "Meridian Health Partners" doesn't.
  for (let i = 0; i < w.length; ) {
    let run = "";
    let hit: { a: T; key: string; end: number } | null = null;
    for (let j = i; j < Math.min(w.length, i + 6); j++) {
      run = run ? `${run} ${w[j]}` : w[j];
      const a = byName.get(run);
      if (a) hit = { a, key: run, end: j + 1 };
    }
    if (!hit) {
      i++;
      continue;
    }
    const c = counts.get(hit.a) ?? { n: 0, len: hit.key.length };
    counts.set(hit.a, { n: c.n + 1, len: c.len });
    i = hit.end;
  }
  let best: T | null = null;
  let bestScore = { n: 0, len: 0 };
  for (const [a, c] of counts) {
    if (c.n > bestScore.n || (c.n === bestScore.n && c.len > bestScore.len)) {
      best = a;
      bestScore = c;
    }
  }
  return best;
}
