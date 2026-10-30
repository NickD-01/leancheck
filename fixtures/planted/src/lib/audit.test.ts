import { expect, test, vi } from "vitest";

const { create, findUnique } = vi.hoisted(() => ({
  create: vi.fn(async () => ({})),
  findUnique: vi.fn(async () => null),
}));
vi.mock("./prisma", () => ({ prisma: { auditLog: { create }, user: { findUnique } } }));

import { loadAuditActors, recordAuditEvents } from "./audit";

test("records each audit event", async () => {
  await recordAuditEvents([{ action: "login", userId: "u1" }]);
  expect(create).toHaveBeenCalledWith({ data: { action: "login", userId: "u1" } });
});

test("looks up each audit actor", async () => {
  expect(await loadAuditActors(["u1", "u2"])).toEqual([null, null]);
});
