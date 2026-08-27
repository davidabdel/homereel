import { NextResponse } from "next/server";
import { authorizeGeneration, chargeCredits } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  return process.env[name];
}

export async function POST(req: Request) {
  try {
    const gate = await authorizeGeneration("video");
    if ("error" in gate) return gate.error;

    const form = await req.formData();
    const imageUrl = (form.get("imageUrl") as string) || ""; // required
    const dialogue = (form.get("dialogue") as string) || ""; // optional
    const aspectRatio = (form.get("aspectRatio") as string) || "16:9";
    const videoPrompt = (form.get("videoPrompt") as string) || "Short UGC-style product ad video";
    const optimizedPrompt = (form.get("optimizedPrompt") as string) || ""; // optional: pre-built final prompt
    const voiceGender = (form.get("voiceGender") as string) || ""; // "Male" | "Female"
    const voiceAccent = (form.get("voiceAccent") as string) || "";

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";
    // According to KIE API docs, valid model names are "veo3" or "veo3_fast"
    const envModel = env("KIE_VIDEO_MODEL");
    console.log("[DEBUG] KIE_VIDEO_MODEL from env:", envModel);
    const MODEL = envModel ?? "veo3_fast";
    console.log("[DEBUG] Final MODEL value:", MODEL);
    const CALLBACK = env("KIE_CALLBACK_URL");

    if (!KIE_API_KEY) {
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    const image_size = ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "16:9";

    // Compose final instruction. If client provided an optimizedPrompt (via OpenAI), use it verbatim.
    // Otherwise, build from videoPrompt + dialogue as before.
    let finalPrompt = optimizedPrompt.trim();
    if (!finalPrompt) {
      const narration = dialogue
        ? ` Narration: In a ${voiceGender || "neutral"} voice with a ${voiceAccent || "natural"} accent, say: "${dialogue}".`
        : "";
      finalPrompt = `${videoPrompt.trim()}${narration}`.trim();
    }

    const isPublicUrl = /^https?:\/\//i.test(imageUrl);
    const payload: any = {
      prompt: finalPrompt,
      imageUrls: isPublicUrl ? [imageUrl] : [],
      model: "veo3_fast", // Force the correct model name directly
      aspectRatio: image_size,
      // Optional flags recommended by docs
      enableFallback: true, // Enable fallback to handle potential errors
      enableTranslation: true,
    };
    if (CALLBACK) payload.callBackUrl = CALLBACK;

    try {
      console.debug("[KIE][video] generate payload", {
        ...payload,
        imageUrls: payload.imageUrls && payload.imageUrls.length ? ["<redacted>"] : [],
      });
      console.log("[DEBUG] Raw payload model value:", payload.model);
      console.log("[DEBUG] Full payload:", JSON.stringify(payload, null, 2));
    } catch (e) {
      console.error("[DEBUG] Error logging payload:", e);
    }

    const createRes = await fetch(`${KIE_API_BASE}/api/v1/veo/generate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const createJson = await createRes.json().catch(() => ({}));
    try {
      console.debug("[KIE][video] generate response", { status: createRes.status, ok: createRes.ok, body: createJson });
    } catch {}
    if (!createRes.ok || createJson?.code !== 200) {
      const sanitized = {
        model: payload.model,
        hasCallback: Boolean(payload.callBackUrl),
        prompt: payload.prompt,
        aspectRatio: payload.aspectRatio,
        image_urls_present: Array.isArray(payload.imageUrls) && payload.imageUrls.length > 0,
      };
      return NextResponse.json({ ok: false, error: `Create task failed: ${createJson?.msg || createRes.status}`, raw: createJson, sent: sanitized }, { status: 502 });
    }

    const taskId: string | undefined = createJson?.data?.taskId;
    if (!taskId) return NextResponse.json({ ok: false, error: "Missing taskId in response", raw: createJson }, { status: 502 });

    await chargeCredits(gate.auth.supabase, gate.cost, "Video generation");

    return NextResponse.json({ ok: true, taskId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
