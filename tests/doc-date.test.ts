import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { parsePdfDate } = await import("@/lib/doc-text");

describe("parsePdfDate", () => {
  it("reads a PDF date with a time zone", () => {
    expect(parsePdfDate("D:20260912103000-04'00'")?.toISOString()).toBe("2026-09-12T14:30:00.000Z");
  });
  it("reads a bare date and a UTC date", () => {
    expect(parsePdfDate("D:20250301")?.toISOString()).toBe("2025-03-01T00:00:00.000Z");
    expect(parsePdfDate("D:20250301120000Z")?.toISOString()).toBe("2025-03-01T12:00:00.000Z");
  });
  it("rejects nonsense and the far future", () => {
    expect(parsePdfDate("yesterday")).toBeNull();
    expect(parsePdfDate("D:29990101")).toBeNull();
  });
});
