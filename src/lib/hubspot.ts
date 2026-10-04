// Minimal HubSpot CRM v3 client for the one-way sync (HubSpot -> Mothership).
// Uses a private app access token with read scopes for companies, contacts, deals and owners.

const API_BASE = process.env.HUBSPOT_API_BASE ?? "https://api.hubapi.com";

export class HubSpotError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 429 && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    return request(token, path, attempt + 1);
  }
  if (!res.ok) {
    if (res.status === 401) throw new HubSpotError("HubSpot didn't accept the key. Check it was copied in full and hasn't been rotated.", 401);
    if (res.status === 403) {
      throw new HubSpotError("The HubSpot key is missing a permission. It needs read access to companies, contacts, deals and owners.", 403);
    }
    throw new HubSpotError(`HubSpot returned an error (${res.status}). Try again in a few minutes.`, res.status);
  }
  return (await res.json()) as T;
}

export type HubSpotRecord = {
  id: string;
  properties: Record<string, string | null>;
  updatedAt?: string;
  associations?: { companies?: { results: { id: string; type?: string }[] } };
};

type Page = { results: HubSpotRecord[]; paging?: { next?: { after: string } } };

// Lists every record of a type, following pagination.
export async function listAll(token: string, objectType: "companies" | "contacts" | "deals", properties: string[], associations?: string) {
  const all: HubSpotRecord[] = [];
  let after: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "100", properties: properties.join(","), archived: "false" });
    if (associations) params.set("associations", associations);
    if (after) params.set("after", after);
    const page = await request<Page>(token, `/crm/v3/objects/${objectType}?${params}`);
    all.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return all;
}

export type HubSpotOwner = { id: string; email: string | null; firstName: string | null; lastName: string | null };

export async function listOwners(token: string) {
  const all: HubSpotOwner[] = [];
  let after: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const page = await request<{ results: HubSpotOwner[]; paging?: { next?: { after: string } } }>(token, `/crm/v3/owners?${params}`);
    all.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  return all;
}

export type HubSpotStage = { id: string; label: string; metadata?: { probability?: string; isClosed?: string } };

export async function listDealStages(token: string) {
  const res = await request<{ results: { id: string; stages: HubSpotStage[] }[] }>(token, "/crm/v3/pipelines/deals");
  return res.results.flatMap((p) => p.stages);
}
