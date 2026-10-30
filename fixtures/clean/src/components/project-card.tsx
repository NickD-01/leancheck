import Link from "next/link";
import { formatCents } from "@/lib/money";
import type { ProjectSummary } from "@/lib/queries";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <strong>{project.name}</strong>
      <span>{formatCents(project.budgetCents)}</span>
    </Link>
  );
}
