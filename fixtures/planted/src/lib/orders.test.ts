import { expect, test } from "vitest";
import { attachCustomers } from "./orders";

test("attaches the matching customer to each order", () => {
  const result = attachCustomers(
    [
      { id: "o1", userId: "u2", totalCents: 500 },
      { id: "o2", userId: "u9", totalCents: 700 },
    ],
    [
      { id: "u1", name: "Ann" },
      { id: "u2", name: "Bram" },
    ],
  );
  expect(result[0]?.customer).toEqual({ id: "u2", name: "Bram" });
  expect(result[1]?.customer).toBeUndefined();
});
