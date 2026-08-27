"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listProjects, type ProjectWithUrl } from "@/lib/projects-service";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectWithUrl[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listProjects();
      if (!cancelled) {
        setProjects(all.slice(0, 8));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasProjects = projects.length > 0;

  return (
    <div className="space-y-6">
      {/* Welcome / CTA */}
      <div className="glass-card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-[#131118]/70 text-sm">Create a new ad or continue where you left off.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/app/create" className="btn-primary">Create New Ad</Link>
          <Link href="/app/projects" className="btn-ghost">View Projects</Link>
        </div>
      </div>

      {/* Recent Projects */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Projects</h2>
          <Link href="/app/projects" className="text-sm text-[#131118]/70 hover:underline">See all</Link>
        </div>

        {loading ? (
          <div className="glass-card flex items-center justify-center py-16 text-sm text-[#131118]/60">
            Loading…
          </div>
        ) : hasProjects ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/app/projects/${p.id}`} className="glass-card block">
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-[#131118]/5">
                  {p.displayUrl ? (
                    p.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.displayUrl} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={p.displayUrl} className="h-full w-full object-cover" />
                    )
                  ) : null}
                </div>
                <div className="mt-3 flex items-start justify-between">
                  <div>
                    <div className="font-medium leading-6">{p.title}</div>
                    <div className="text-xs text-[#131118]/60">Updated {timeAgo(p.updated_at)}</div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] border-[3px] border-[#131118] capitalize">
                    {p.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card flex flex-col items-center justify-center text-center py-16">
            <div className="mb-4 h-16 w-16 rounded-2xl border-[3px] border-[#131118] bg-[#131118]/5" />
            <h3 className="text-xl font-semibold">No projects yet</h3>
            <p className="mt-2 max-w-sm text-sm text-[#131118]/70">
              Create your first reel to see it appear here. Your drafts and renders will show up with status.
            </p>
            <Link href="/app/create" className="mt-6 btn-primary">Create your first reel</Link>
          </div>
        )}
      </section>
    </div>
  );
}
