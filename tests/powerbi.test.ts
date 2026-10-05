import { describe, expect, it } from "vitest";
import { isPublicLink, parseEmbedUrl } from "@/lib/powerbi";

describe("parseEmbedUrl", () => {
  const link = "https://app.powerbi.com/reportEmbed?reportId=abc-123&autoAuth=true&ctid=t-1";
  it("accepts a secure embed link or the iframe snippet", () => {
    expect(parseEmbedUrl(link)).toBe(link);
    expect(parseEmbedUrl(`<iframe title="Sales" width="1140" src="${link.replace(/&/g, "&amp;")}" frameborder="0"></iframe>`)).toBe(link);
    expect(parseEmbedUrl("https://app.powerbigov.us/reportEmbed?reportId=x")).toBe("https://app.powerbigov.us/reportEmbed?reportId=x");
  });
  it("rejects other sites and non-embed pages", () => {
    expect(parseEmbedUrl("https://evil.example/reportEmbed?x=1")).toBeNull();
    expect(parseEmbedUrl("http://app.powerbi.com/reportEmbed?x=1")).toBeNull();
    expect(parseEmbedUrl("https://app.powerbi.com/groups/me/reports/abc")).toBeNull();
    expect(parseEmbedUrl("https://app.powerbi.com/groups/me/apps")).toBeNull();
    expect(parseEmbedUrl("not a link")).toBeNull();
  });
  it("turns the address bar link into an embed link", () => {
    expect(
      parseEmbedUrl("https://app.powerbi.com/groups/me/reports/558bf078-de8e-4068-8cb0-cfab8318b72e/5c4775d1326375ef279a?experience=power-bi&amp;clientSideAuth=0"),
    ).toBe("https://app.powerbi.com/reportEmbed?reportId=558bf078-de8e-4068-8cb0-cfab8318b72e&autoAuth=true&pageName=5c4775d1326375ef279a");
    expect(parseEmbedUrl("https://app.powerbi.com/groups/1111aaaa-0000-0000-0000-000000000000/reports/558bf078-de8e-4068-8cb0-cfab8318b72e?ctid=t-9")).toBe(
      "https://app.powerbi.com/reportEmbed?reportId=558bf078-de8e-4068-8cb0-cfab8318b72e&groupId=1111aaaa-0000-0000-0000-000000000000&autoAuth=true&ctid=t-9",
    );
  });
  it("spots Publish to web links", () => {
    expect(isPublicLink("https://app.powerbi.com/view?r=xyz")).toBe(true);
    expect(isPublicLink(link)).toBe(false);
  });
});

describe("sales rep report links", async () => {
  const { canEmbed, parseRepReportUrl } = await import("@/lib/rep-report");
  it("accepts SharePoint links and embed code, and rejects other sites", () => {
    expect(parseRepReportUrl("https://applemoving.sharepoint.com/:x:/s/Sales/EabC123?e=xyz")).toBe("https://applemoving.sharepoint.com/:x:/s/Sales/EabC123?e=xyz");
    expect(parseRepReportUrl('<iframe width="402" src="https://applemoving.sharepoint.com/sites/Sales/_layouts/15/Doc.aspx?sourcedoc={abc}&amp;action=embedview"></iframe>')).toBe(
      "https://applemoving.sharepoint.com/sites/Sales/_layouts/15/Doc.aspx?sourcedoc={abc}&action=embedview",
    );
    expect(parseRepReportUrl("https://evil.example.com/sharepoint.com")).toBeNull();
    expect(parseRepReportUrl("http://applemoving.sharepoint.com/x")).toBeNull();
  });
  it("embeds only links Microsoft allows in other sites", () => {
    expect(canEmbed("https://applemoving.sharepoint.com/sites/Sales/_layouts/15/Doc.aspx?sourcedoc={abc}&action=embedview")).toBe(true);
    expect(canEmbed("https://applemoving.sharepoint.com/:x:/s/Sales/EabC123?e=xyz")).toBe(false);
    expect(canEmbed(parseRepReportUrl("https://app.powerbi.com/reportEmbed?reportId=558bf078-de8e-4068-8cb0-cfab8318b72e&autoAuth=true")!)).toBe(true);
  });
});

import { marketForFile } from "@/lib/rate-sheet-match";

describe("rate sheet file names", () => {
  const markets = [{ name: "El Paso" }, { name: "Columbus, GA" }, { name: "San Antonio" }, { name: "Ft. Walton Beach" }, { name: "Del Rio" }];
  it("finds the market a file names", () => {
    expect(marketForFile("2026 Commercial Rate Sheet - El Paso.pdf", markets)?.name).toBe("El Paso");
    expect(marketForFile("2026 Commercial Rate Sheet - Columbus.pdf", markets)?.name).toBe("Columbus, GA");
    expect(marketForFile("rate sheet ft walton beach.PDF", markets)?.name).toBe("Ft. Walton Beach");
    expect(marketForFile("Standard rate sheet.pdf", markets)).toBeNull();
    expect(marketForFile("Paso Robles.pdf", markets)).toBeNull();
  });
});
