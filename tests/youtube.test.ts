import { describe, expect, it } from "vitest";
import { youTubeId } from "@/lib/youtube";

describe("youTubeId", () => {
  it("reads the common link shapes", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("ignores other links", () => {
    expect(youTubeId("https://contoso.sharepoint.com/sites/x")).toBeNull();
    expect(youTubeId("https://www.youtube.com/@channel")).toBeNull();
    expect(youTubeId("not a link")).toBeNull();
  });
});
