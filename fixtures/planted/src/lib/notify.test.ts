import { expect, test, vi } from "vitest";
import { notifyCustomers } from "./notify";

test("emails every customer once", async () => {
  const send = vi.fn(async () => undefined);
  expect(await notifyCustomers(["a@example.test", "b@example.test"], send)).toBe(2);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledWith("b@example.test", "Your order has shipped");
});
