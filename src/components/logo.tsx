export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className={big ? "h-9 w-9" : "h-7 w-7"} aria-hidden>
        <ellipse cx="16" cy="18" rx="14" ry="5" fill="currentColor" opacity="0.35" />
        <path d="M8 17a8 8 0 0 1 16 0z" fill="currentColor" />
        <circle cx="16" cy="12" r="2" fill="#7dd3fc" />
      </svg>
      <div className="leading-tight">
        <div className={`font-bold tracking-tight ${big ? "text-2xl" : "text-base"}`}>Mothership</div>
        {big && <div className="text-xs opacity-80">Relocation Shephard Software</div>}
      </div>
    </div>
  );
}
