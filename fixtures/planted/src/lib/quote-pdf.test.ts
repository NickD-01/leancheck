import { expect, test } from "vitest";
import { renderQuote } from "./quote-pdf";

test("quote states its validity before the lines", () => {
  const lines = renderQuote("Q-7", 30, [{ description: "Grout", quantity: 1, unitCents: 550 }]).split("\n");
  expect(lines.slice(0, 2)).toEqual(["QUOTE Q-7", "Valid for 30 days"]);
  expect(lines.at(-1)).toMatch(/6\.66$/);
});
