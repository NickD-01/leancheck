import { describe, expect, test, vi } from "vitest";

const { findFirst, where } = vi.hoisted(() => ({
  findFirst: vi.fn(async () => ({ id: "u1", name: "Ann", email: "ann@example.test" })),
  where: vi.fn(),
}));
vi.mock("../db", () => ({
  db: {
    query: { users: { findFirst } },
    select: () => ({ from: () => ({ where }) }),
  },
}));

import { loadCustomers, requireUser } from "./customers";

describe("customers", () => {
  test("loads one customer per id", async () => {
    expect(await loadCustomers(["u1", "u2"])).toHaveLength(2);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  test("requireUser throws when the user is missing", async () => {
    where.mockResolvedValueOnce([]);
    await expect(requireUser("missing")).rejects.toThrow("User not found");
  });
});
