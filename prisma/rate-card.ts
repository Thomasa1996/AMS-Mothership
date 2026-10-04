// Apple Moving and Storage standard commercial rate sheet (2026), used to seed the rate card.
// Rates are in dollars here and converted to cents when seeded.

export type RateSeed = { category: string; name: string; unit: string; rate: number; notes?: string };

const section = (category: string, unit: string, items: [string, number, string?][]): RateSeed[] =>
  items.map(([name, rate, notes]) => ({ category, name, unit, rate, notes }));

export const RATE_CARD: RateSeed[] = [
  ...section("Small Job Rates", "hour", [
    ["2 Crew, 1 Truck", 170],
    ["3 Crew, 1 Truck", 210],
    ["4 Crew, 1 Truck", 267],
  ]),
  ...section("Project Crew Rates", "hour", [
    ["Project Director", 180],
    ["Rigging Project Manager", 98],
    ["Project Manager", 83],
    ["Supervisor", 63],
    ["Driver w/Tractor Trailer", 110],
    ["Driver w/Straight Truck", 90],
    ["Installer", 60],
    ["Mover/Packer", 50],
    ["Union Mover/Packer", 55],
    ["Warehouse Supervisor", 70],
    ["Warehouseman", 40],
    ["Forklift Operator", 90],
    ["PC Technician", 50],
    ["Furniture Repair Technician", 80],
    ["Space Planner", 90],
  ]),
  { category: "Additional Fees", name: "Fuel Surcharge (RVA Metro area)", unit: "flat", rate: 50 },
  { category: "Additional Fees", name: "Fuel Surcharge (outside DC Metro area)", unit: "mile", rate: 1.5 },
  { category: "Additional Fees", name: "Parking Permit Fee", unit: "each", rate: 55, notes: "Plus actual permit cost" },
  { category: "Additional Fees", name: "Crew Transportation Van", unit: "day", rate: 135 },
  { category: "Storage", name: "Storage", unit: "sq. ft. per month", rate: 1.75, notes: "96 sq. ft. minimum; pick-up and delivery at hourly rates" },
  { category: "Storage", name: "Storage – Climate Controlled", unit: "sq. ft. per month", rate: 5.75, notes: "96 sq. ft. minimum" },
  { category: "Storage", name: "Warehouse Handling", unit: "sq. ft.", rate: 1.75, notes: "Storage in and out" },
  { category: "Storage", name: "Digital Imagery Storage", unit: "sq. ft.", rate: 4.75, notes: "Setup and warehouse in" },
  { category: "Storage", name: "Monthly Trailer Storage", unit: "month", rate: 980 },
  { category: "Storage", name: "Overnight Truck Storage", unit: "night per truck", rate: 47 },
  ...section("Equipment Rental", "each per day", [
    ["Book Cart Rental", 6],
    ["Commercial Bins (no dollies)", 2],
    ["Furniture Dollies", 1],
    ["Panel Carts", 6],
    ["Blue Pads", 1],
    ["Steel Dollies", 8],
  ]),
  { category: "Purge (Disposal) & Shred", name: "Purge/shred bin (96-gallon)", unit: "each", rate: 120, notes: "Includes pickup and delivery" },
  { category: "Purge (Disposal) & Shred", name: "Purge/shred bin (65-gallon)", unit: "each", rate: 85 },
  { category: "Purge (Disposal) & Shred", name: "Shredding", unit: "lb.", rate: 0.27 },
  { category: "Purge (Disposal) & Shred", name: "Standard Size Carton (1.2 cu. ft.)", unit: "each", rate: 10 },
  { category: "Purge (Disposal) & Shred", name: "Legal Size Carton (2.4 – 3.0 cu. ft.)", unit: "each", rate: 20 },
  { category: "Recycling", name: "Electronic Recycling Service", unit: "bin load", rate: 225, notes: "Includes pickup and recycling" },
  { category: "Recycling", name: "Asset Recycle/Dump Fee", unit: "truck", rate: 700, notes: "Plus labor (processing and recycling)" },
  { category: "Recycling", name: "Hard Drive Shredding – Off-site", unit: "each", rate: 9, notes: "Volume pricing available" },
  ...section("Rental Crates", "each per day", [
    ["Standard Packing Crates (4:1 dolly ratio)", 0.39],
    ["Standard Packing Crates (3:1 dolly ratio)", 0.49],
    ["Standard Packing Crates (2:1 dolly ratio)", 0.78],
    ["Lateral Crate", 0.78],
    ["PC Crate (w/ monitor bag)", 2.4],
  ]),
  { category: "Delivery & Pick-up", name: "Rental Item Delivery Fee", unit: "flat", rate: 215, notes: "Includes 1 delivery and 1 pick-up" },
  { category: "Delivery & Pick-up", name: "Additional Delivery or Pick-up", unit: "each", rate: 125 },
  { category: "Delivery & Pick-up", name: "Rental Item Delivery/Pick-up Fee (After Hours)", unit: "each", rate: 320 },
  { category: "Delivery & Pick-up", name: "Materials Delivery Charge", unit: "flat", rate: 215 },
  { category: "Delivery & Pick-up", name: "Courier Delivery Charge", unit: "flat", rate: 215 },
  { category: "Delivery & Pick-up", name: "FedEx Delivery Charge (Letter Size)", unit: "each", rate: 33 },
  ...section("IT Technical Services", "unit", [
    ["PC Disconnect/Reconnect", 46],
    ["PC Disconnect only", 21],
    ["PC Reconnect only", 26],
  ]),
  { category: "IT Technical Services", name: "Monitor Arm Mount", unit: "each", rate: 15 },
  { category: "IT Technical Services", name: "Monitor Mount w/ Tension Adjustment", unit: "each", rate: 18 },
  ...section("Packing Materials & Moving Supplies", "each", [
    ["Legal Office Totes (2.3 cu. ft.)", 4.75],
    ["PC Pouches", 3],
    ["Labels (500 count)", 43],
    ["Stretch Wrap (clear/black)", 50],
    ["Bubble Wrap (Anti-static)", 125],
    ["Bubble Wrap (Regular)", 105],
    ["Coroflex", 190],
    ["Ram Board (200 ft. roll)", 140],
    ["Plastic Tape", 6],
    ["Newsprint (25 lb. bundle)", 49],
    ["Dish Pack", 14.5],
  ]),
];

export const RATE_CARD_NOTES = `Small job minimums: 2.5 hours labor + 1.5 hours travel (8AM – 4PM start); 3.5 hours labor + 1.5 hours travel (4PM – 8AM start).
Travel time: 1.5 hours for local VA, MD and DC (under 40 miles); 2 hours for 40–60 miles; portal-to-portal for 60+ miles.
Overtime: 1.5x standard rates for hours over 8 per day, Sundays and holidays.
IT unit: a docking station or PC with 2 monitors, speakers, keyboard, mouse and webcam.
The rates listed are for common services and materials. Additional services and materials will be invoiced at standard rates. A full rate listing is available upon request.`;
