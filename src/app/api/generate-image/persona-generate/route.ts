import { NextResponse } from "next/server";
import { authorizeGeneration, chargeCredits } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  const direct = process.env[name];
  if (direct !== undefined) return direct;
  const normalize = (k: string) =>
    k
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
      .replace(/^\s+|\s+$/g, ""); // trim spaces
  const foundKey = Object.keys(process.env).find((k) => normalize(k) === name);
  return foundKey ? process.env[foundKey] : undefined;
}

export async function POST(req: Request) {
  try {
    const gate = await authorizeGeneration("image");
    if ("error" in gate) return gate.error;

    const form = await req.formData();
    const prompt = (form.get("prompt") as string) || "";
    const personaSummary = (form.get("personaSummary") as string) || "";
    const aspectRatio = (form.get("aspectRatio") as string) || "16:9";

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";
    // Hardcode base model for persona-generate to avoid env misconfiguration
    const MODEL = "google/nano-banana" as const;
    const CALLBACK = env("KIE_CALLBACK_URL");

    // Diagnostics: mask secrets, only log presence/length
    try {
      const allEnvKeys = Object.keys(process.env);
      const matchedKieKey = allEnvKeys.find((k) => k.trim() === "KIE_API_KEY") || null;
      const kieNamedKeys = allEnvKeys.filter((k) => /KIE/i.test(k)).sort();
      console.debug("[Diag][persona-generate] envs", {
        has_KIE_API_KEY: Boolean(KIE_API_KEY),
        KIE_API_KEY_len: KIE_API_KEY?.length ?? 0,
        matched_env_key_name: matchedKieKey, // shows if there's whitespace variant
        kie_named_env_keys: kieNamedKeys,     // names only, no values
        KIE_API_BASE,
        has_CALLBACK: Boolean(CALLBACK),
        NODE_ENV: process.env.NODE_ENV,
      });
    } catch {}

    if (!KIE_API_KEY) {
      try {
        const allEnvKeys = Object.keys(process.env);
        const kieNamedKeys = allEnvKeys.filter((k) => /KIE/i.test(k)).sort();
        console.debug("[Diag][persona-generate] missing KIE_API_KEY", { kie_named_env_keys: kieNamedKeys });
        return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured", kie_named_env_keys: kieNamedKeys }, { status: 500 });
      } catch {
        return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
      }
    }

    const image_size = ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";

    // Build final prompt. No image upload for persona generate flow.
    const personText = (prompt && prompt.trim()) ? prompt.trim() : (personaSummary || "");
    const finalPrompt = personText || prompt;

    const payload = {
      model: MODEL,
      callBackUrl: CALLBACK,
      input: {
        prompt: finalPrompt,
        output_format: "png",
        image_size,
      },
    };

    try {
      console.debug("[KIE][persona-generate] payload", { model: payload.model, input: payload.input });
    } catch {}

    const createRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const createJson = await createRes.json().catch(() => ({}));
    try { console.debug("[KIE][persona-generate] response", { status: createRes.status, ok: createRes.ok, body: createJson }); } catch {}

    if (!createRes.ok || createJson?.code !== 200) {
      return NextResponse.json(
        { ok: false, error: `Create task failed: ${createJson?.msg || createRes.status}`, raw: createJson, modelUsed: MODEL },
        { status: 502 }
      );
    }

    const taskId: string | undefined = createJson?.data?.taskId;
    if (!taskId) return NextResponse.json({ ok: false, error: "Missing taskId in response", raw: createJson }, { status: 502 });

    await chargeCredits(gate.auth.supabase, gate.cost, "Image generation");

    return NextResponse.json({ ok: true, taskId, modelUsed: MODEL });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
