// Vendor grading: each teammate scores a vendor 1-5 on a few criteria, and the vendor's
// letter grade comes from the average of every score.

export const RATING_CRITERIA = [
  { id: "quality", label: "Quality of work" },
  { id: "timeliness", label: "On time" },
  { id: "pricing", label: "Pricing" },
  { id: "communication", label: "Communication" },
] as const;

export type Criterion = (typeof RATING_CRITERIA)[number]["id"];
export type Scores = Record<Criterion, number>;

export const GRADES = ["A", "B", "C", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];

// 4.5+ is an A, 3.5+ a B, 2.5+ a C, 1.5+ a D, anything lower an F.
export function gradeFor(score: number | null): Grade | null {
  if (score == null || !Number.isFinite(score)) return null;
  if (score >= 4.5) return "A";
  if (score >= 3.5) return "B";
  if (score >= 2.5) return "C";
  if (score >= 1.5) return "D";
  return "F";
}

// Lowest average that still earns the grade, for "B or better" filters.
export const GRADE_FLOOR: Record<Grade, number> = { A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0 };

export function overall(r: Scores): number {
  return RATING_CRITERIA.reduce((sum, c) => sum + r[c.id], 0) / RATING_CRITERIA.length;
}

export type VendorScore = { average: number; grade: Grade; count: number; byCriterion: Scores };

export function summarize(ratings: Scores[]): VendorScore | null {
  if (ratings.length === 0) return null;
  const byCriterion = Object.fromEntries(
    RATING_CRITERIA.map((c) => [c.id, ratings.reduce((s, r) => s + r[c.id], 0) / ratings.length]),
  ) as Scores;
  const average = overall(byCriterion);
  return { average, grade: gradeFor(average)!, count: ratings.length, byCriterion };
}

export function gradeTone(grade: Grade | null): string {
  switch (grade) {
    case "A": return "bg-emerald-100 text-emerald-800";
    case "B": return "bg-lime-100 text-lime-800";
    case "C": return "bg-amber-100 text-amber-800";
    case "D": return "bg-orange-100 text-orange-800";
    case "F": return "bg-rose-100 text-rose-700";
    default: return "bg-slate-100 text-slate-500";
  }
}
