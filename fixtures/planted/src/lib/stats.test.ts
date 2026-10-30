import { expect, test } from "vitest";
import { summarizeOrderTotals } from "./stats";

test("summarizes order totals in cents", () => {
  expect(summarizeOrderTotals([1200, 800, 3000])).toEqual({ count: 3, sumCents: 5000, maxCents: 3000 });
});

test("an empty list has a zero maximum", () => {
  expect(summarizeOrderTotals([])).toEqual({ count: 0, sumCents: 0, maxCents: 0 });
});
