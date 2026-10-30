"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { importTasks } from "@/lib/dashboard";
import { parseEuroInput } from "@/lib/money";

const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  budget: z.string().default("0"),
});

export async function createProject(formData: FormData): Promise<void> {
  const input = projectInput.parse(Object.fromEntries(formData));
  const [created] = await db
    .insert(projects)
    .values({
      name: input.name,
      description: input.description || null,
      budgetCents: parseEuroInput(input.budget),
    })
    .returning({ id: projects.id });
  if (!created) throw new Error("Project could not be created");
  revalidatePath("/");
  redirect(`/projects/${created.id}`);
}

export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  const id = z.string().uuid().parse(taskId);
  const [task] = await db
    .update(tasks)
    .set({ done })
    .where(eq(tasks.id, id))
    .returning({ projectId: tasks.projectId });
  if (task) revalidatePath(`/projects/${task.projectId}`);
}

const MAX_IMPORTED_TASKS = 100;

export async function importTaskList(projectId: string, formData: FormData): Promise<void> {
  const id = z.string().uuid().parse(projectId);
  const titles = String(formData.get("titles") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_IMPORTED_TASKS);
  await importTasks(id, titles);
  revalidatePath(`/projects/${id}`);
}
