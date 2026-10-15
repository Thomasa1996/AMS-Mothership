// Forecast per market from the proposals in Sales > Quotes: what's won, plus open proposals
// weighted by how often that market wins. A market with fewer than MIN_DECIDED won or lost
// proposals uses the company's win rate instead, so one early loss doesn't zero its forecast.

export const MIN_DECIDED = 3;

export type ForecastDoc = { branchId: string | null; totalCents: number | null; outcome: string | null };
export type MarketForecast = {
  branchId: string | null;
  proposals: number;
  openCents: number;
  wonCents: number;
  lostCents: number;
  won: number;
  lost: number;
  // The rate used for the forecast (0-1), and whether it's the market's own or the company's.
  winRate: number | null;
  ownRate: boolean;
  forecastCents: number;
};

const rateOf = (won: number, lost: number) => (won + lost ? won / (won + lost) : null);

export function forecastByMarket(docs: ForecastDoc[]): MarketForecast[] {
  const company = rateOf(docs.filter((d) => d.outcome === "WON").length, docs.filter((d) => d.outcome === "LOST").length);
  const rows = new Map<string | null, MarketForecast>();
  for (const d of docs) {
    const r =
      rows.get(d.branchId) ??
      rows.set(d.branchId, { branchId: d.branchId, proposals: 0, openCents: 0, wonCents: 0, lostCents: 0, won: 0, lost: 0, winRate: null, ownRate: false, forecastCents: 0 }).get(d.branchId)!;
    const cents = d.totalCents ?? 0;
    r.proposals++;
    if (d.outcome === "WON") {
      r.won++;
      r.wonCents += cents;
    } else if (d.outcome === "LOST") {
      r.lost++;
      r.lostCents += cents;
    } else r.openCents += cents;
  }
  for (const r of rows.values()) {
    r.ownRate = r.won + r.lost >= MIN_DECIDED;
    r.winRate = r.ownRate ? rateOf(r.won, r.lost) : company;
    r.forecastCents = Math.round(r.wonCents + r.openCents * (r.winRate ?? 0));
  }
  // Biggest forecast first; proposals with no market last.
  return [...rows.values()].sort((a, b) => (a.branchId === null ? 1 : 0) - (b.branchId === null ? 1 : 0) || b.forecastCents - a.forecastCents);
}
