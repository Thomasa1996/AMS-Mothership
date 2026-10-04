// Minimal Apollo.io client for Sales, New Business Development.
// People search is free; looking a person up (to get their full name and work email) uses Apollo credits.
// Needs an Apollo master API key, since people search isn't open to ordinary keys.

const API_BASE = process.env.APOLLO_API_BASE ?? "https://api.apollo.io";

export class ApolloError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | string[] | undefined>;

// Apollo takes filters as query parameters, with arrays written as name[]=a&name[]=b.
export function toQuery(params: Params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((item) => q.append(`${k}[]`, item));
    else q.set(k, String(v));
  }
  return q.toString();
}

async function post<T>(key: string, path: string, params: Params): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}?${toQuery(params)}`, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });
  } catch {
    throw new ApolloError("Couldn't reach Apollo. Try again in a minute.", 0);
  }
  if (!res.ok) {
    if (res.status === 401) throw new ApolloError("Apollo didn't accept the API key. Check it was copied in full and hasn't been deleted.", 401);
    if (res.status === 403) {
      throw new ApolloError("This Apollo key can't search people. In Apollo, create a new API key and turn on \"Set as master key\", then paste it in Settings, Apollo.", 403);
    }
    if (res.status === 422) throw new ApolloError("Apollo refused the request. Your Apollo account may be out of credits.", 422);
    if (res.status === 429) throw new ApolloError("Apollo's rate limit was hit. Wait a minute and try again.", 429);
    throw new ApolloError(`Apollo returned an error (${res.status}). Try again in a few minutes.`, res.status);
  }
  return (await res.json()) as T;
}

export const SENIORITIES = [
  { id: "owner", label: "Owner" },
  { id: "founder", label: "Founder" },
  { id: "c_suite", label: "C-suite" },
  { id: "partner", label: "Partner" },
  { id: "vp", label: "VP" },
  { id: "head", label: "Head" },
  { id: "director", label: "Director" },
  { id: "manager", label: "Manager" },
  { id: "senior", label: "Senior" },
  { id: "entry", label: "Entry" },
] as const;

export const COMPANY_SIZES = [
  { id: "1,10", label: "1 to 10" },
  { id: "11,50", label: "11 to 50" },
  { id: "51,200", label: "51 to 200" },
  { id: "201,500", label: "201 to 500" },
  { id: "501,1000", label: "501 to 1,000" },
  { id: "1001,5000", label: "1,001 to 5,000" },
  { id: "5001,10000", label: "5,001 to 10,000" },
  { id: "10001,1000000", label: "10,001 or more" },
] as const;

export const PAGE_SIZES = [25, 50, 100] as const;

export type PeopleSearch = {
  keywords?: string;
  titles: string[];
  exactTitles?: boolean;
  personLocations: string[];
  companyLocations: string[];
  seniorities: string[];
  sizes: string[];
  industries?: string[];
  domains?: string[];
  revenueMin?: number;
  revenueMax?: number;
  verifiedEmail?: boolean;
  page: number;
  perPage?: number;
};

export type ApolloSearchPerson = {
  id: string;
  first_name: string | null;
  last_name_obfuscated?: string | null;
  last_name?: string | null;
  title: string | null;
  has_email?: boolean;
  organization?: { name?: string | null } | null;
};

export const PER_PAGE = 25;


export async function searchPeople(key: string, s: PeopleSearch) {
  const res = await post<{ total_entries?: number; people?: ApolloSearchPerson[] }>(key, "/api/v1/mixed_people/api_search", {
    q_keywords: s.keywords,
    person_titles: s.titles,
    include_similar_titles: s.exactTitles && s.titles.length ? false : undefined,
    person_locations: s.personLocations,
    organization_locations: s.companyLocations,
    person_seniorities: s.seniorities,
    organization_num_employees_ranges: s.sizes,
    q_organization_keyword_tags: s.industries,
    q_organization_domains_list: s.domains,
    "revenue_range[min]": s.revenueMin,
    "revenue_range[max]": s.revenueMax,
    contact_email_status: s.verifiedEmail ? ["verified"] : undefined,
    page: s.page,
    per_page: s.perPage ?? PER_PAGE,
  });
  return { total: res.total_entries ?? 0, people: res.people ?? [] };
}

// A one-result search, used to check a key works (and can search people) before saving it. Uses no credits.
export async function checkKey(key: string) {
  await post(key, "/api/v1/mixed_people/api_search", { person_titles: ["facilities manager"], per_page: 1 });
}

export type ApolloPerson = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  state?: string | null;
  organization?: {
    name?: string | null;
    website_url?: string | null;
    primary_domain?: string | null;
    phone?: string | null;
    sanitized_phone?: string | null;
    industry?: string | null;
    raw_address?: string | null;
  } | null;
};

// Looks up one person by Apollo id. Uses Apollo credits.
export async function enrichPerson(key: string, id: string) {
  const res = await post<{ person?: ApolloPerson | null }>(key, "/api/v1/people/match", { id, reveal_personal_emails: false });
  if (!res.person) throw new ApolloError("Apollo couldn't find that person any more.", 404);
  return res.person;
}

const clean = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : null;
};

// "Logistics & supply chain" -> as is; "logistics & supply chain" -> "Logistics & supply chain".
const sentence = (v: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : null);

export function personToContact(p: ApolloPerson) {
  const name = clean(p.name) ?? ([clean(p.first_name), clean(p.last_name)].filter(Boolean).join(" ") || "Unnamed contact");
  const email = clean(p.email);
  // Apollo puts a placeholder in email when it has none.
  return { name, title: clean(p.title), email: email && !email.includes("email_not_unlocked") ? email.toLowerCase() : null };
}

export function personToAccount(p: ApolloPerson) {
  const o = p.organization ?? {};
  const site = clean(o.website_url) ?? (clean(o.primary_domain) ? `https://${clean(o.primary_domain)}` : null);
  return {
    name: clean(o.name) ?? "Company not listed in Apollo",
    website: site,
    phone: clean(o.sanitized_phone) ?? clean(o.phone),
    industry: sentence(clean(o.industry)),
    address: clean(o.raw_address),
  };
}

// Search form fields come in as comma-separated text.
export const splitList = (v: string | null | undefined) =>
  (v ?? "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

// "$5M", "5,000,000", "2.5m", "750k" -> dollars. Blank or unreadable -> undefined.
export function parseMoney(v: string | null | undefined) {
  const m = (v ?? "").trim().toLowerCase().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
  if (!m) return undefined;
  const mult = { "": 1, k: 1e3, m: 1e6, b: 1e9 }[m[2] as "" | "k" | "m" | "b"];
  return Math.round(Number(m[1]) * mult);
}
