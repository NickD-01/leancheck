import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { TaskToggle } from "@/components/task-toggle";
import { formatCents } from "@/lib/money";
import { getProject, listOpenTasks } from "@/lib/queries";
import { importTaskList } from "../actions";

type ProjectPageProps = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const openTasks = await listOpenTasks(project.id);

  return (
    <article>
      <h1>{project.name}</h1>
      {project.description ? <p>{project.description}</p> : null}
      <p>Budget: {formatCents(project.budgetCents)}</p>
      <h2>Open tasks</h2>
      <ul>
        {openTasks.map((task) => (
          <li key={task.id}>
            <TaskToggle taskId={task.id} title={task.title} done={task.done} />
          </li>
        ))}
      </ul>
      <form action={importTaskList.bind(null, project.id)}>
        <textarea name="titles" placeholder="One task per line" />
        <SubmitButton>Import tasks</SubmitButton>
      </form>
    </article>
  );
}
