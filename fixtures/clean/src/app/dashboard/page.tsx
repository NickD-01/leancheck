import Link from "next/link";
import { loadDashboard } from "@/lib/dashboard";

export default async function DashboardPage() {
  const { total, rows } = await loadDashboard();

  return (
    <section>
      <h1>Dashboard</h1>
      <p>{total} projects in total</p>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {row.title}
            {row.project ? <Link href={`/projects/${row.project.id}`}> ({row.project.name})</Link> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
