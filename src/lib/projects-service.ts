import { createSupabaseBrowserClient } from "./supabase";

export type ProjectType = "image" | "video";
export type ProjectStatus = "draft" | "rendering" | "ready" | "failed";

export type Project = {
  id: string;
  user_id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  source_url: string | null;
  media_path: string | null;
  created_at: string;
  updated_at: string;
};

// A project plus a ready-to-display URL (signed storage URL, or the source
// fallback while the durable copy is still being made / if it failed).
export type ProjectWithUrl = Project & { displayUrl: string | null };

const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function withDisplayUrl(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  project: Project
): Promise<ProjectWithUrl> {
  let displayUrl: string | null = project.source_url;
  if (project.media_path) {
    const { data } = await supabase.storage
      .from("media")
      .createSignedUrl(project.media_path, SIGNED_URL_TTL);
    if (data?.signedUrl) displayUrl = data.signedUrl;
  }
  return { ...project, displayUrl };
}

/** List the current user's projects, newest first, with display URLs resolved. */
export async function listProjects(): Promise<ProjectWithUrl[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("listProjects error:", error.message);
    return [];
  }
  return Promise.all((data as Project[]).map((p) => withDisplayUrl(supabase, p)));
}

/** Fetch one project (RLS ensures it belongs to the caller). */
export async function getProject(id: string): Promise<ProjectWithUrl | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return withDisplayUrl(supabase, data as Project);
}

/**
 * Create a project row for a freshly generated asset and kick off a durable
 * copy of the asset into Supabase Storage. Never throws — a storage hiccup
 * must not break the generation flow, since source_url still works short-term.
 */
export async function saveProject(input: {
  userId: string;
  type: ProjectType;
  title: string;
  sourceUrl: string;
}): Promise<Project | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      status: "ready",
      source_url: input.sourceUrl,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("saveProject error:", error?.message);
    return null;
  }
  const project = data as Project;

  // Persist a durable copy in the background (don't await the caller on it).
  void persistMedia(project.id, input.type, input.sourceUrl);
  return project;
}

async function persistMedia(projectId: string, type: ProjectType, sourceUrl: string) {
  // Data URLs (mock mode with no KIE key) are already self-contained; skip.
  if (/^data:/i.test(sourceUrl)) return;
  try {
    const res = await fetch("/api/media/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, type, url: sourceUrl }),
    });
    if (!res.ok) return;
    const json = await res.json().catch(() => null);
    if (json?.ok && json.path) {
      const supabase = createSupabaseBrowserClient();
      await supabase.from("projects").update({ media_path: json.path }).eq("id", projectId);
    }
  } catch (e) {
    console.warn("persistMedia failed (source_url still usable):", e);
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    console.error("deleteProject error:", error.message);
    return false;
  }
  return true;
}
