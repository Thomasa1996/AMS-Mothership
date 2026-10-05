// Matches a rate sheet file name ("2026 Rate Sheet - El Paso.pdf") to the market it names.
const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function marketForFile<T extends { name: string }>(fileName: string, markets: T[]): T | null {
  const file = ` ${simple(fileName.replace(/\.pdf$/i, ""))} `;
  let best: T | null = null;
  for (const m of markets) {
    // "El Paso, TX" matches a file naming just "El Paso".
    const names = [m.name, m.name.split(",")[0]].map(simple).filter(Boolean);
    if (names.some((n) => file.includes(` ${n} `)) && (!best || m.name.length > best.name.length)) best = m;
  }
  return best;
}
