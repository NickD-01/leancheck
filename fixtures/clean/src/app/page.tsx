import { ProjectCard } from "@/components/project-card";
import { SearchBox } from "@/components/search-box";
import { listProjects } from "@/lib/queries";

type HomeProps = { searchParams: Promise<{ q?: string }> };

export default async function HomePage({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const projects = await listProjects(q);

  return (
    <section>
      <h1>Projects</h1>
      <SearchBox initialQuery={q ?? ""} />
      {projects.length === 0 ? (
        <p>No projects yet.</p>
      ) : (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
