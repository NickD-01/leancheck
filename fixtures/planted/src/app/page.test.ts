import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("../lib/customers", () => ({
  listProductNames: vi.fn(async () => [{ id: "p1", name: "Tile" }]),
  listOrdersForUser: vi.fn(async () => [{ id: "o1", totalCents: 1200 }, { id: "o2", totalCents: 800 }]),
}));

import DashboardPage from "./page";

test("dashboard counts products and orders", async () => {
  const html = renderToStaticMarkup(await DashboardPage());
  expect(html).toContain("1 products, 2 orders");
});
