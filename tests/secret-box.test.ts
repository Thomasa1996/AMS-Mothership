import { beforeAll, describe, expect, it } from "vitest";
import { open, seal } from "@/lib/secret-box";

describe("secret box", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
  });

  it("round-trips and hides the value", () => {
    const sealed = seal("pat-na1-abc");
    expect(sealed).not.toContain("pat-na1");
    expect(open(sealed)).toBe("pat-na1-abc");
  });

  it("can't be opened with a different secret", () => {
    const sealed = seal("pat-na1-abc");
    process.env.SESSION_SECRET = "another-secret-at-least-16";
    expect(open(sealed)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
  });
});
