import { expect, test } from "vitest";
import { snapshotCart } from "./cart";

test("snapshot is an independent deep copy", () => {
  const cart = { id: "c1", lines: [{ productId: "p1", quantity: 2, addedAt: "2026-10-01" }] };
  const copy = snapshotCart(cart);
  expect(copy).toEqual(cart);
  expect(copy.lines).not.toBe(cart.lines);
});
