"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProject, deleteProject, type ProjectWithUrl } from "@/lib/projects-service";

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectWithUrl | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getProject(id);
      if (!cancelled) {
        setProject(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const download = async () => {
    if (!project?.displayUrl) return;
    try {
      const res = await fetch(project.displayUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = project.type === "image" ? (blob.type.includes("jpeg") ? "jpg" : "png") : "mp4";
      a.download = `${project.title?.replace(/\s+/g, "-") || project.type}-${ts}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {}
  };

  const remove = async () => {
    if (!project || !confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    await deleteProject(project.id);
    router.push("/app/projects");
  };

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center py-16 text-sm text-[#131118]/60">
        Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-xl font-semibold">Project not found</h3>
        <p className="mt-2 text-sm text-[#131118]/70">It may have been deleted.</p>
        <Link href="/app/projects" className="mt-6 btn-primary">Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card !p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <div className="text-xs text-[#131118]/60 capitalize">
              {project.type} • {project.status} • Created {new Date(project.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={download} disabled={!project.displayUrl}>
              Download
            </button>
            <button className="btn-ghost hover:text-red-400" onClick={remove}>Delete</button>
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="glass-card !p-3">
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          {project.displayUrl ? (
            project.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.displayUrl} alt={project.title} className="h-full w-full object-contain" />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={project.displayUrl} controls className="h-full w-full object-contain" />
            )
          ) : (
            <div className="grid h-full place-items-center text-xs text-[#131118]/60">No preview available</div>
          )}
        </div>
      </div>

      <div className="text-sm text-[#131118]/70">
        <Link href="/app/projects" className="hover:underline">Back to projects</Link>
      </div>
    </div>
  );
}
