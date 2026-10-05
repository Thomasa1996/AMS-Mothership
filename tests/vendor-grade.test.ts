import { describe, expect, it } from "vitest";
import { gradeFor, summarize } from "@/lib/vendor-grade";

describe("vendor grades", () => {
  it("maps averages to letters", () => {
    expect(gradeFor(5)).toBe("A");
    expect(gradeFor(4.5)).toBe("A");
    expect(gradeFor(4.49)).toBe("B");
    expect(gradeFor(3)).toBe("C");
    expect(gradeFor(1.5)).toBe("D");
    expect(gradeFor(1)).toBe("F");
    expect(gradeFor(null)).toBeNull();
  });

  it("averages every teammate's scores", () => {
    const s = summarize([
      { quality: 5, timeliness: 5, pricing: 4, communication: 5 },
      { quality: 3, timeliness: 4, pricing: 4, communication: 3 },
    ])!;
    expect(s.count).toBe(2);
    expect(s.byCriterion.quality).toBe(4);
    expect(s.average).toBeCloseTo(4.125);
    expect(s.grade).toBe("B");
    expect(summarize([])).toBeNull();
  });
});
