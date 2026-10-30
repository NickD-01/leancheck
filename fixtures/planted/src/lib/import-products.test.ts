import { expect, test, vi } from "vitest";

const { values, insert } = vi.hoisted(() => {
  const values = vi.fn(async () => undefined);
  return { values, insert: vi.fn(() => ({ values })) };
});
vi.mock("../db", () => ({ db: { insert } }));

import { importProducts } from "./import-products";

test("inserts every product row", async () => {
  const rows = [
    { name: "Tile", priceCents: 1000 },
    { name: "Grout", priceCents: 550 },
  ];
  expect(await importProducts(rows)).toBe(2);
  expect(values).toHaveBeenCalledWith({ name: "Grout", priceCents: 550 });
});
