import { NextResponse } from "next/server";
import { listProjects } from "@/lib/queries";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("q") ?? undefined;
  const projects = await listProjects(search);
  return NextResponse.json({ success: true, data: projects });
}
