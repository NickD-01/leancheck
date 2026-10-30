import { expect, test, vi } from "vitest";
import { exportAllRows } from "./export";

test("follows the cursor until the last page", async () => {
  const fetchPage = vi.fn(async (cursor: string | null) =>
    cursor === null ? { rows: ["a", "b"], nextCursor: "p2" } : { rows: ["c"], nextCursor: null },
  );
  expect(await exportAllRows(fetchPage)).toEqual(["a", "b", "c"]);
  expect(fetchPage).toHaveBeenLastCalledWith("p2");
});
