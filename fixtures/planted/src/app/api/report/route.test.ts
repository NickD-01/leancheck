import { expect, test } from "vitest";
import { GET } from "./route";

test("serves the report template as HTML", async () => {
  const res = await GET();
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(await res.text()).toContain("Monthly report");
});
