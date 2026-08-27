"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listProjects, deleteProject, type ProjectWithUrl } from "@/lib/projects-service";

type FilterType = "Images" | "Videos" | "All";

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

export default function ProjectsPage() {
  const [filter, setFilter] = useState<FilterType>("All");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [items, setItems] = useState<ProjectWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [active, setActive] = useState<ProjectWithUrl | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const projects = await listProjects();
      if (!cancelled) {
        setItems(projects);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openViewer = (p: ProjectWithUrl) => {
    setActive(p);
    setShowModal(true);
  };

  const removeProject = async (p: ProjectWithUrl) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    if (active?.id === p.id) setShowModal(false);
    await deleteProject(p.id);
  };

  const downloadActive = async () => {
    if (!active?.displayUrl) return;
    try {
      const res = await fetch(active.displayUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");

      let extension = ".mp4";
      if (active.type === "image") {
        extension = blob.type.includes("png")
          ? ".png"
          : blob.type.includes("jpeg") || blob.type.includes("jpg")
            ? ".jpg"
            : ".png";
      }

      const prefix = active.type === "image" ? "ugc-image" : "ugc-video";
      a.download = `${active.title?.replace(/\s+/g, "-") || prefix}-${ts}${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {}
  };

  const filtered = items.filter((p) => {
    if (filter === "All") return true;
    if (filter === "Images") return p.type === "image";
    if (filter === "Videos") return p.type === "video";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 !p-4">
        <div className="flex items-center gap-2 text-sm font-bold uppercase">
          {(["Images", "Videos", "All"] as FilterType[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`border-[3px] border-[#131118] px-3 py-1 ${
                filter === s ? "bg-[#131118] text-[#F1EEE3]" : "bg-transparent hover:bg-[#D8FF3E]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm font-bold uppercase">
          <button
            className={`border-[3px] border-[#131118] px-3 py-1 ${layout === "grid" ? "bg-[#D8FF3E]" : "bg-transparent"}`}
            onClick={() => setLayout("grid")}
          >
            Grid
          </button>
          <button
            className={`border-[3px] border-[#131118] px-3 py-1 ${layout === "list" ? "bg-[#D8FF3E]" : "bg-transparent"}`}
            onClick={() => setLayout("list")}
          >
            List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center py-16 text-sm text-[#131118]/60">
          Loading your projects…
        </div>
      ) : filtered.length ? (
        layout === "grid" ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <div key={p.id} className="glass-card block text-left">
                <button onClick={() => openViewer(p)} className="block w-full text-left">
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-[#131118]/5">
                    {p.displayUrl ? (
                      p.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.displayUrl} alt={p.title} className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={p.displayUrl} className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-[#131118]/60">No preview</div>
                    )}
                  </div>
                  <div className="mt-3 flex items-start justify-between">
                    <div>
                      <div className="font-medium leading-6">{p.title}</div>
                      <div className="text-xs text-[#131118]/60">Updated {timeAgo(p.updated_at)}</div>
                    </div>
                    <span className="border-[2px] border-[#131118] bg-[#D8FF3E] px-2 py-0.5 text-[10px] font-bold uppercase">
                      {p.status}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => removeProject(p)}
                  className="mt-2 text-xs text-[#131118]/50 hover:text-[#FF3E5F]"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card divide-y divide-white/10 p-0">
            {filtered.map((p) => (
              <div key={p.id} className="flex w-full items-center gap-4 px-4 py-3 hover:bg-[#131118]/5">
                <button onClick={() => openViewer(p)} className="flex flex-1 items-center gap-4 text-left">
                  <div className="h-14 w-24 overflow-hidden rounded-lg bg-[#131118]/5">
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
                  <div className="flex-1">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-[#131118]/60">Updated {timeAgo(p.updated_at)}</div>
                  </div>
                </button>
                <span className="border-[2px] border-[#131118] bg-[#D8FF3E] px-2 py-0.5 text-[10px] font-bold uppercase">
                  {p.status}
                </span>
                <button onClick={() => removeProject(p)} className="text-xs text-[#131118]/50 hover:text-[#FF3E5F]">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 h-16 w-16 border-[3px] border-[#131118] bg-[#131118]/5" />
          <h3 className="text-xl font-semibold">No projects yet</h3>
          <p className="mt-2 max-w-sm text-sm text-[#131118]/70">Create New Ad to get started.</p>
          <Link href="/app/create" className="mt-6 btn-primary">Create New Ad</Link>
        </div>
      )}

      {/* Viewer modal */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowModal(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0B0D12]">
              <div className="flex items-center justify-between border-b border-white/10 p-3">
                <div className="text-sm text-white/70">{active?.title || "Preview"}</div>
                <div className="flex gap-2">
                  <button
                    className={`btn-ghost ${!active?.displayUrl ? "pointer-events-none opacity-60" : ""}`}
                    onClick={downloadActive}
                    disabled={!active?.displayUrl}
                  >
                    {active?.type === "image" ? "Download Image" : "Download Video"}
                  </button>
                  {active?.displayUrl ? (
                    <a className="btn-ghost" href={active.displayUrl} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                  ) : null}
                  <button className="btn-ghost" onClick={() => setShowModal(false)}>Close</button>
                </div>
              </div>
              <div className="aspect-video w-full bg-black">
                {active?.displayUrl ? (
                  active?.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.displayUrl} alt={active.title} className="h-full w-full object-contain" />
                  ) : (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={active.displayUrl} controls autoPlay className="h-full w-full object-contain" />
                  )
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[#131118]/60">No preview</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
