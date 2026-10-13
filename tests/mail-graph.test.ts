import { describe, expect, it } from "vitest";
import { looksLikeProposal } from "@/lib/mail-graph";

const file = (name: string, size = 1000) => ({ id: "a", name, contentType: "application/pdf", size });

describe("looksLikeProposal", () => {
  it("takes documents named or sent as a proposal", () => {
    expect(looksLikeProposal("Hello", file("Acme Proposal.pdf"))).toBe(true);
    expect(looksLikeProposal("Your moving quote", file("Acme.docx"))).toBe(true);
  });
  it("skips pictures, unrelated documents and huge files", () => {
    expect(looksLikeProposal("Proposal", file("logo.png"))).toBe(false);
    expect(looksLikeProposal("Invoice 4411", file("invoice.pdf"))).toBe(false);
    expect(looksLikeProposal("Proposal", file("Proposal.pdf", 50 * 1024 * 1024))).toBe(false);
  });
});
