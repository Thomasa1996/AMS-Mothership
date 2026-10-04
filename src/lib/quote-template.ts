// Default proposal boilerplate, taken from Apple Moving's "Project Recommendation Plan" quotes.
// Each company can edit these in Settings > Quote template. Placeholders:
//   {company}  the company's display name, e.g. "Apple Moving"
//   {service}  the quote's service description, e.g. "Decommission services in Oak Ridge Tennessee"

export const DEFAULT_TEMPLATE = {
  intro:
    "Thank you for allowing {company} to present a recommendation for your upcoming need for {service}. These services will be custom designed and executed to meet all your needs and requirements.",
  investmentHeading: "Investment Required for Professional for Relocation and Storage Services",
  valuation:
    "{company} assumes liability for damages to all items handled by our personnel during the course of providing moving services. Its limited liability covers loss or damage to goods not to exceed the sum of $0.60 per pound per item for furniture and $5.00 per pound per item for electronics unless the client has requested greater valuation at the agreed upon rate for Replacement Valuation. Standard Valuation (included) - I hereby release my property at the declared value of $0.60 per pound per item not to exceed $50.00 per article for furniture and $5.00 per pound per item for electronics with a $100.00 deductible at no additional charge per the terms and conditions of this contract.",
  optionalValuation:
    "Optional Full Replacement Valuation: Loss or damage will be adjusted based on the value of Client's property at the time of the loss (depreciated value) and settled on the lesser cost to repair or replace with property of comparable material and quality used for the same purpose. Adjustment will not exceed the declared value listed below. Minimum valuation is $20,000. The additional premium for this coverage will be reflected on your final invoice. Declared Value $______________ - Premium: $10.50/ $1,000 of coverage with a $500 Deductible",
  companyDuties: [
    "Supplying signage for the destination, including numbered and color-coded office placards and signs.",
    "Providing colored labels for employees to mark furniture and belongings.",
    "Assigning full-time, uniformed, and trained personnel for the move.",
    "Ensuring consistency in the moving crew throughout the project, potentially including a dedicated Project Manager to oversee the process.",
    "Installing protective materials at both the starting location and destination before the move.",
    "Disassembling desks with return hutches as needed.",
    'Using the "floating" method for moving furniture, keeping all items secured on dollies from the starting location to the destination.',
    "Conducting a final walkthrough to confirm that all items have been relocated properly.",
  ].join("\n"),
  clientDuties: [
    "Informing {company} of any specific security requirements for the project at the time of booking, such as U.S. citizenship verification, security clearance for crew members, pre-approved crew lists, or truck screenings.",
    "Obtaining move-in/out procedures and certificate of insurance (COI) requirements from the property managers at both locations and providing them to {company} in advance.",
    "Reserving all necessary loading docks, entryways, elevators, and access points for the entire move at both locations in coordination with property managers.",
    "Securing any necessary parking meters at both locations (if applicable) to ensure dedicated loading and unloading areas.",
    "Confirming with property managers that {company} crews will have exclusive access to loading zones and the new office space during the move.",
    "Scheduling a walkthrough with property managers at both locations before the move begins to document any pre-existing conditions.",
    "Arranging for an elevator technician to be on standby at both locations in case of equipment issues.",
    "Ensuring that a company representative is present at both locations for each phase of the move.",
  ].join("\n"),
};

export type CompanyTemplate = {
  name: string;
  displayName: string | null;
  quoteIntro: string | null;
  quoteInvestmentHeading: string | null;
  quoteValuation: string | null;
  quoteOptionalValuation: string | null;
  quoteCompanyDuties: string | null;
  quoteClientDuties: string | null;
};

// The template a new quote starts from: the company's saved text, falling back to the defaults.
export function templateFor(company: CompanyTemplate) {
  return {
    intro: company.quoteIntro ?? DEFAULT_TEMPLATE.intro,
    investmentHeading: company.quoteInvestmentHeading ?? DEFAULT_TEMPLATE.investmentHeading,
    valuation: company.quoteValuation ?? DEFAULT_TEMPLATE.valuation,
    optionalValuation: company.quoteOptionalValuation ?? DEFAULT_TEMPLATE.optionalValuation,
    companyDuties: company.quoteCompanyDuties ?? DEFAULT_TEMPLATE.companyDuties,
    clientDuties: company.quoteClientDuties ?? DEFAULT_TEMPLATE.clientDuties,
  };
}

export function fillPlaceholders(text: string, values: { company: string; service: string }): string {
  return text.replaceAll("{company}", values.company).replaceAll("{service}", values.service);
}

// Splits multi-line text into list items, dropping bullet characters people paste in.
export function toListItems(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[•\-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}
