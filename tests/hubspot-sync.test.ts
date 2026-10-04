import { describe, expect, it } from "vitest";
import { companyToAccount, contactFields, dealToProject, industryLabel, mapDealStage } from "@/lib/hubspot-sync";

describe("HubSpot mapping", () => {
  it("maps the default pipeline stages", () => {
    expect(mapDealStage("appointmentscheduled")).toBe("LEAD");
    expect(mapDealStage("presentationscheduled")).toBe("SURVEY");
    expect(mapDealStage("contractsent")).toBe("QUOTED");
    expect(mapDealStage("closedwon")).toBe("BOOKED");
    expect(mapDealStage("closedlost")).toBe("LOST");
  });

  it("maps custom stages by win probability", () => {
    const stages = [
      { id: "a", label: "Won", metadata: { probability: "1.0", isClosed: "true" } },
      { id: "b", label: "Lost", metadata: { probability: "0.0", isClosed: "true" } },
      { id: "c", label: "Proposal", metadata: { probability: "0.7", isClosed: "false" } },
      { id: "d", label: "Walkthrough", metadata: { probability: "0.4", isClosed: "false" } },
    ];
    expect(["a", "b", "c", "d", "zzz"].map((id) => mapDealStage(id, stages))).toEqual(["BOOKED", "LOST", "QUOTED", "SURVEY", "LEAD"]);
  });

  it("turns a company into an account", () => {
    expect(
      companyToAccount({
        id: "1",
        properties: { name: " CSR Eco Solutions ", domain: "csr.example", industry: "LOGISTICS_AND_SUPPLY_CHAIN", address: "1 Main St", city: "Atlanta", state: "GA", zip: "30301", phone: null },
      }),
    ).toEqual({ name: "CSR Eco Solutions", website: "csr.example", phone: null, industry: "Logistics and supply chain", address: "1 Main St, Atlanta, GA 30301" });
    expect(industryLabel(null)).toBeNull();
  });

  it("builds contact names and lowercases emails", () => {
    expect(contactFields({ id: "1", properties: { firstname: "Ann", lastname: null, email: "Ann@X.com", mobilephone: "555" } })).toEqual({
      name: "Ann",
      title: null,
      email: "ann@x.com",
      phone: "555",
    });
  });

  it("rounds deal amounts to whole dollars and handles blanks", () => {
    expect(dealToProject({ id: "1", properties: { dealname: "Move", dealstage: "closedwon", amount: "4940.6" } }, []).estimatedValue).toBe(4941);
    expect(dealToProject({ id: "2", properties: { dealname: "Move", dealstage: "closedwon", amount: "" } }, []).estimatedValue).toBeNull();
  });
});
