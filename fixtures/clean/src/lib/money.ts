const euro = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

export function parseEuroInput(input: string): number {
  const normalised = input.trim().replace(/\./g, "").replace(",", ".");
  const value = Number(normalised);
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid amount");
  return Math.round(value * 100);
}
