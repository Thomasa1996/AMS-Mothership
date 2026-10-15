// Reads a proposal's total out of its text: the dollar amount on the line labeled as the total
// ("Firm Fixed Project Total: $33,322.50", "Grand Total $12,000"). Returns cents, or null when no
// line reads like a total, so a valuation figure or per-pound rate is never taken for the price.

const AMOUNT = /\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)/g;
// Totals that aren't the price: coverage limits, valuation and deductibles.
const NOT_PRICE = /not to exceed|per pound|valuation|declared value|deductible|premium|coverage/i;
const STRONG = /grand total|project total|total investment|total project|total price|total cost|proposal total|quote total|estimate total/i;

function amounts(line: string): number[] {
  return [...line.matchAll(AMOUNT)].map((m) => Math.round(Number(m[1].replace(/,/g, "")) * 100)).filter((c) => c > 0);
}

export function findProposalTotal(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pick = (test: (l: string) => boolean): number | null => {
    let found: number | null = null;
    lines.forEach((line, i) => {
      if (!test(line) || NOT_PRICE.test(line)) return;
      // A table often puts the label in one cell and the amount on the next line.
      const own = amounts(line);
      const next = !own.length && lines[i + 1] && !NOT_PRICE.test(lines[i + 1]) ? amounts(lines[i + 1]) : [];
      const all = own.length ? own : next;
      if (all.length) found = all[all.length - 1];
    });
    return found;
  };
  return (
    pick((l) => STRONG.test(l)) ??
    pick((l) => /\btotal\b/i.test(l) && !/sub-?\s?total/i.test(l)) ??
    pick((l) => /sub-?\s?total/i.test(l))
  );
}
