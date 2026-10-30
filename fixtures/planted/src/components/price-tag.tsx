"use client";

export function PriceTag({ cents }: { cents: number }) {
  return <span className="price">€ {(cents / 100).toFixed(2)}</span>;
}
