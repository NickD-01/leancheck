import { expect, test } from "vitest";
import { renderInvoice } from "./invoice-pdf";

test("invoice lists lines and adds 21% VAT", () => {
  const text = renderInvoice("2026-001", [{ description: "Tiles", quantity: 2, unitCents: 1000 }]);
  expect(text.startsWith("INVOICE 2026-001")).toBe(true);
  expect(text).toContain("20.00");
  expect(text).toMatch(/Total\s+24\.20$/);
});
