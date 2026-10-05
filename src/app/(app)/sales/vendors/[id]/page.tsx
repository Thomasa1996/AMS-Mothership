import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { MISSING_COMPANY } from "@/lib/constants";
import { ConfirmButton } from "@/app/(app)/crm/forms";
import { deleteVendor, updateVendor } from "../actions";
import { VendorForm } from "../forms";
import { vendorOptions } from "../options";
import { VerificationBadge } from "../status-badge";
import { GradeBadge } from "../grade-badge";
import { RatingForm } from "../rating-form";
import { deleteVendorRating, rateVendor } from "../rating-actions";
import { RATING_CRITERIA, gradeFor, overall, summarize } from "@/lib/vendor-grade";

const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const vendor = await db.vendor.findFirst({ where: { id, companyId: user.companyId } });
  if (!vendor) notFound();
  const [options, ratings, others] = await Promise.all([
    vendorOptions(user.companyId),
    db.vendorRating.findMany({
      where: { vendorId: vendor.id, companyId: user.companyId },
      include: { user: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    vendor.name === MISSING_COMPANY
      ? []
      : db.vendor.findMany({
          where: { companyId: user.companyId, name: vendor.name, category: vendor.category, id: { not: vendor.id } },
          orderBy: { position: "asc" },
        }),
  ]);

  const score = summarize(ratings);
  const mine = ratings.find((r) => r.userId === user.id) ?? null;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={vendor.name}
        subtitle={
          <span className="flex items-center gap-2">
            <Link href={`/sales/vendors?category=${encodeURIComponent(vendor.category)}`} className="link">{vendor.category}</Link>
            <VerificationBadge status={vendor.verificationStatus} />
            <GradeBadge grade={score?.grade ?? null} />
          </span>
        }
      />
      <div className="card mb-6 grid gap-6 p-5 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold">Vendor grade</h2>
          {score ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-4xl font-bold">{score.grade}</span>
                <span className="text-sm text-slate-500">
                  {score.average.toFixed(1)} of 5 from {score.count} {score.count === 1 ? "rating" : "ratings"}
                </span>
              </div>
              <dl className="space-y-1.5 text-sm">
                {RATING_CRITERIA.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <dt className="w-32 text-slate-600">{c.label}</dt>
                    <dd className="h-2 flex-1 rounded bg-slate-100">
                      <div className="h-2 rounded bg-[#f59e0b]" style={{ width: `${(score.byCriterion[c.id] / 5) * 100}%` }} />
                    </dd>
                    <dd className="w-8 text-right tabular-nums">{score.byCriterion[c.id].toFixed(1)}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-500">No one has graded this vendor yet. Scores of 4.5 and up are an A, 3.5 a B, 2.5 a C, 1.5 a D, and lower an F.</p>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{mine ? "Your rating" : "Rate this vendor"}</h2>
          <RatingForm key={mine?.updatedAt.toISOString() ?? "new"} action={rateVendor.bind(null, vendor.id)} defaults={mine} />
        </div>
      </div>
      {ratings.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="mb-2 text-sm font-semibold">Team ratings</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {ratings.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-2">
                <GradeBadge grade={gradeFor(overall(r))} />
                <div className="min-w-0 flex-1">
                  <div>
                    <span className="font-medium">{r.user.name}</span>
                    <span className="text-slate-500"> · {day.format(r.updatedAt)}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {RATING_CRITERIA.map((c) => `${c.label} ${r[c.id]}`).join(" · ")}
                  </div>
                  {r.comment && <p className="mt-1 whitespace-pre-wrap">{r.comment}</p>}
                </div>
                {(r.userId === user.id || user.role === "ADMIN") && (
                  <ConfirmButton action={deleteVendorRating.bind(null, r.id)} label="Remove" className="text-xs text-rose-600 hover:underline" confirmText={`Remove ${r.user.name}'s rating?`} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {others.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="mb-2 text-sm font-semibold">Other contacts at {vendor.name}</h2>
          <ul className="space-y-1 text-sm">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/sales/vendors/${o.id}`} className="link">{o.contactName ?? "No named contact"}</Link>
                {o.phone && <span className="text-slate-500"> · {o.phone}</span>}
                {o.email && <span className="text-slate-500"> · {o.email}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card p-5">
        <VendorForm action={updateVendor.bind(null, vendor.id)} defaults={vendor} {...options} submitLabel="Save changes" />
      </div>
      <div className="mt-4">
        <ConfirmButton action={deleteVendor.bind(null, vendor.id)} label="Delete vendor" confirmText={`Delete ${vendor.name}?`} />
      </div>
    </div>
  );
}
