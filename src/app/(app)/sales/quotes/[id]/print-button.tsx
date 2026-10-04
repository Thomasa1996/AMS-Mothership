"use client";

export function PrintButton() {
  return (
    <button className="btn" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
