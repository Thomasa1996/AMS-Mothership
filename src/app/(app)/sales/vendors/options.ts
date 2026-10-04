import { db } from "@/lib/db";

export async function vendorOptions(companyId: string) {
  const [categories, statuses] = await Promise.all([
    db.vendor.groupBy({ by: ["category"], where: { companyId }, orderBy: { category: "asc" } }),
    db.vendor.groupBy({
      by: ["verificationStatus"],
      where: { companyId, verificationStatus: { not: null } },
      orderBy: { verificationStatus: "asc" },
    }),
  ]);
  return {
    categories: categories.map((c) => c.category),
    statuses: statuses.map((s) => s.verificationStatus).filter((s): s is string => !!s),
  };
}
