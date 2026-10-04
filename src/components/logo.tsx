export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mothership-logo.png" alt="" className={`rounded-md object-cover ${big ? "h-12 w-12" : "h-8 w-8"}`} />
      <div className="leading-tight">
        <div className={`font-bold tracking-tight ${big ? "text-2xl" : "text-base"}`}>Mothership</div>
        {big && <div className="text-xs opacity-80">Relocation Shephard Software</div>}
      </div>
    </div>
  );
}
