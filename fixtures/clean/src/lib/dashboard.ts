import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { listProjects } from "@/lib/queries";

const MAX_DASHBOARD_TASKS = 200;

export async function loadDashboard() {
  const [recent, [totals]] = await Promise.all([
    listProjects(),
    db.select({ n: count() }).from(projects),
  ]);
  const ids = recent.map((p) => p.id);
  const openTasks = ids.length
    ? await db
        .select({ id: tasks.id, projectId: tasks.projectId, title: tasks.title })
        .from(tasks)
        .where(inArray(tasks.projectId, ids))
        .limit(MAX_DASHBOARD_TASKS)
    : [];
  const byProject = new Map(recent.map((p) => [p.id, p]));
  const rows = openTasks.map((t) => ({ ...t, project: byProject.get(t.projectId) }));
  return { total: totals?.n ?? 0, rows };
}

export async function importTasks(projectId: string, titles: string[]): Promise<void> {
  if (titles.length === 0) return;
  await db.insert(tasks).values(titles.map((title) => ({ projectId, title })));
}

export async function getTask(id: string) {
  return db.query.tasks.findFirst({ columns: { id: true, title: true }, where: eq(tasks.id, id) });
}
