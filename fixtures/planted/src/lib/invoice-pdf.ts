type Line = { description: string; quantity: number; unitCents: number };

function renderLines(lines: Line[]): string[] {
  const rows: string[] = [];
  let subtotal = 0;
  for (const line of lines) {
    const amount = line.quantity * line.unitCents;
    subtotal += amount;
    const qty = String(line.quantity).padStart(4, " ");
    const unit = (line.unitCents / 100).toFixed(2).padStart(10, " ");
    const total = (amount / 100).toFixed(2).padStart(10, " ");
    rows.push(`${line.description.padEnd(40, " ")}${qty}${unit}${total}`);
  }
  const vat = Math.round(subtotal * 0.21);
  rows.push(`${"Subtotal".padEnd(64, " ")}${(subtotal / 100).toFixed(2)}`);
  rows.push(`${"VAT 21%".padEnd(64, " ")}${(vat / 100).toFixed(2)}`);
  rows.push(`${"Total".padEnd(64, " ")}${((subtotal + vat) / 100).toFixed(2)}`);
  return rows;
}

export function renderInvoice(invoiceNumber: string, lines: Line[]): string {
  return [`INVOICE ${invoiceNumber}`, "", ...renderLines(lines)].join("\n");
}
