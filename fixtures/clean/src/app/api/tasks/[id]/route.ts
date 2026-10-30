import { NextResponse } from "next/server";
import { z } from "zod";
import { getTask } from "@/lib/dashboard";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  const task = await getTask(parsed.data);
  if (!task) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: task });
}
