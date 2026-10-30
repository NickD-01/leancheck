import { expect, test } from "vitest";
import { formatOrderDate } from "./dates";

test("formats order dates as DD/MM/YYYY", () => {
  expect(formatOrderDate(new Date(2026, 0, 5))).toBe("05/01/2026");
});
