// Works out which market (branch) a proposal is for from its text: the market named most often,
// counting the market's own name and the cities of its warehouses ("Norfolk" counts for Chesapeake).

export type MarketNames = { id: string; name: string; warehouses: string };

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/\bfort\b/g, "ft")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

// "Colorado Springs, Co 80907" or "el paso tx 79935" -> "colorado springs" / "el paso".
function cityOf(cityStateZip: string) {
  const beforeComma = cityStateZip.split(",")[0];
  const words = norm(beforeComma).trim().split(" ");
  // Without a comma, drop a trailing state and ZIP ("Killeen TX 76543").
  while (words.length > 1 && (/^\d+$/.test(words.at(-1)!) || words.at(-1)!.length === 2)) words.pop();
  return words.join(" ");
}

export function marketNames(m: MarketNames): string[] {
  let cities: string[] = [];
  try {
    cities = (JSON.parse(m.warehouses) as { cityStateZip?: string }[]).map((w) => cityOf(w.cityStateZip ?? ""));
  } catch {
    // No warehouse list; the name alone still matches.
  }
  return [...new Set([norm(m.name.split(",")[0]).trim(), ...cities].filter((n) => n.length >= 3))];
}

export function findMarket<T extends MarketNames>(text: string, markets: T[]): T | null {
  const hay = norm(text);
  let best: T | null = null;
  let bestCount = 0;
  for (const m of markets) {
    let count = 0;
    for (const n of marketNames(m)) count += hay.split(` ${n} `).length - 1;
    if (count > bestCount) {
      best = m;
      bestCount = count;
    }
  }
  return best;
}
