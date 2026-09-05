import type { CloudpediaProject } from "./cloudpedia-data"

type CloudpediaProjectsTableProps = {
  projects: CloudpediaProject[]
}

function statusClasses(status: CloudpediaProject["status"]) {
  if (status === "Blocked") {
    return "border-red-400/20 bg-red-400/10 text-red-300"
  }

  if (status === "In progress") {
    return "border-blue-400/20 bg-blue-400/10 text-blue-300"
  }

  return "border-white/[0.1] bg-white/[0.05] text-zinc-400"
}

export function CloudpediaProjectsTable({
  projects,
}: CloudpediaProjectsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead className="bg-white/[0.03]">
          <tr className="border-b border-white/[0.08] text-[11px] font-medium tracking-[0.12em] text-zinc-600 uppercase">
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.07]">
          {projects.map((project) => (
            <tr key={project.name} className="text-sm">
              <td className="px-4 py-3.5 font-medium text-zinc-200">
                {project.name}
              </td>
              <td className="px-4 py-3.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClasses(project.status)}`}
                >
                  {project.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {projects.length === 0 ? (
        <p className="px-4 py-5 text-sm text-zinc-500">
          No projects match your search.
        </p>
      ) : null}
    </div>
  )
}
