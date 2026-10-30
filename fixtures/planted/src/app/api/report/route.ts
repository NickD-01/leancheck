import { readFileSync } from "node:fs";
import path from "node:path";

export async function GET() {
  const template = readFileSync(path.join(process.cwd(), "templates", "report.html"), "utf8");
  return new Response(template, { headers: { "content-type": "text/html; charset=utf-8" } });
}
