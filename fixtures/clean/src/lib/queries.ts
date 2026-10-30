import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";

const PAGE_SIZE = 20;

export type ProjectSummary = {
  id: string;
  name: string;
  budgetCents: number;
};

export async function listProjects(search?: string): Promise<ProjectSummary[]> {
  return db
    .select({ id: projects.id, name: projects.name, budgetCents: projects.budgetCents })
    .from(projects)
    .where(search ? ilike(projects.name, `%${search}%`) : undefined)
    .orderBy(desc(projects.createdAt))
    .limit(PAGE_SIZE);
}

export async function getProject(id: string) {
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      budgetCents: projects.budgetCents,
    })
    .from(projects)
    .where(eq(projects.id, id));
  return project;
}

export async function listOpenTasks(projectId: string) {
  return db.query.tasks.findMany({
    columns: { id: true, title: true, done: true },
    where: and(eq(tasks.projectId, projectId), eq(tasks.done, false)),
    orderBy: desc(tasks.createdAt),
    limit: PAGE_SIZE,
  });
}
