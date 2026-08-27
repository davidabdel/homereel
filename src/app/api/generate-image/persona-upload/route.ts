import { NextResponse } from "next/server";
import { authorizeGeneration, chargeCredits } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  const direct = process.env[name];
  if (direct !== undefined) return direct;
  const foundKey = Object.keys(process.env).find((k) => k.trim() === name);
  return foundKey ? process.env[foundKey] : undefined;
}

export async function POST(req: Request) {
  try {
    const gate = await authorizeGeneration("image");
    if ("error" in gate) return gate.error;

    const form = await req.formData();
    const file = form.get("file");
    const prompt = (form.get("prompt") as string) || "";
    const personaSummary = (form.get("personaSummary") as string) || "";
    const aspectRatio = (form.get("aspectRatio") as string) || "16:9";

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";
    // Hardcode edit model for persona-upload to avoid env misconfiguration
    const EDIT_MODEL = "google/nano-banana-edit" as const; // edit model
    const CALLBACK = env("KIE_CALLBACK_URL");
    const KIE_UPLOAD_BASE = env("KIE_UPLOAD_BASE") ?? "https://kieai.redpandaai.co";

    // Diagnostics: mask secrets, only log presence/length and key names
    try {
      const allEnvKeys = Object.keys(process.env);
      const matchedKieKey = allEnvKeys.find((k) => k.trim() === "KIE_API_KEY") || null;
      const kieNamedKeys = allEnvKeys.filter((k) => /KIE/i.test(k)).sort();
      console.debug("[Diag][persona-upload] envs", {
        has_KIE_API_KEY: Boolean(KIE_API_KEY),
        KIE_API_KEY_len: KIE_API_KEY?.length ?? 0,
        matched_env_key_name: matchedKieKey,
        kie_named_env_keys: kieNamedKeys,
        KIE_API_BASE,
      });
    } catch {}

    if (!KIE_API_KEY) {
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Reference image file is required" }, { status: 400 });
    }

    const image_size = ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";

    // Upload image and get URL (convert HEIC/HEIF to JPEG if needed)
    let workingFile: File = file;
    const isHeic = /heic|heif/i.test((file as File).type || "") || /\.(heic|heif)$/i.test((file as File).name || "");
    if (isHeic) {
      try {
        const sharp = (await import("sharp")).default;
        const inputBuf = Buffer.from(await (file as File).arrayBuffer());
        const outBuf = await sharp(inputBuf).jpeg({ quality: 90 }).toBuffer();
        const outName = ((file as File).name || "upload").replace(/\.(heic|heif)$/i, ".jpg");
        // Copy into a fresh ArrayBuffer to satisfy File/Blob typing
        const ab = new ArrayBuffer(outBuf.byteLength);
        new Uint8Array(ab).set(outBuf);
        workingFile = new File([ab], outName, { type: "image/jpeg" });
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: "HEIC/HEIF conversion failed; please install sharp or upload PNG/JPG/WebP" },
          { status: 500 }
        );
      }
    }

    let uploadedUrl: string | undefined;
    try {
      const fd = new FormData();
      fd.append("file", workingFile);
      fd.append("uploadPath", "ugc-factory");
      fd.append("fileName", workingFile.name);
      const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
        body: fd,
      });
      const upJson = await upRes.json();
      if (upRes.ok && (upJson?.success || upJson?.code === 200)) {
        uploadedUrl = upJson?.data?.fileUrl || upJson?.data?.url || upJson?.data?.downloadUrl;
      }
    } catch {}
    if (!uploadedUrl) {
      try {
        const arr = await (workingFile as File).arrayBuffer();
        const b64 = Buffer.from(arr).toString("base64");
        const payload = {
          fileBase64: `data:${(workingFile as File).type || "image/png"};base64,${b64}`,
          uploadPath: "ugc-factory",
          fileName: (workingFile as File).name,
        };
        const upRes2 = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const upJson2 = await upRes2.json();
        if (upRes2.ok && (upJson2?.success || upJson2?.code === 200)) {
          uploadedUrl = upJson2?.data?.fileUrl || upJson2?.data?.url || upJson2?.data?.downloadUrl;
        }
      } catch {}
    }

    if (!uploadedUrl) {
      return NextResponse.json({ ok: false, error: "Failed to upload reference image" }, { status: 500 });
    }

    const personText = (prompt && prompt.trim()) ? prompt.trim() : (personaSummary || "");
    const finalPrompt = personText
      ? `Generate this image ${uploadedUrl} and generate this person ${personText}`
      : `Generate this image ${uploadedUrl}`;

    const payload = {
      model: EDIT_MODEL,
      callBackUrl: CALLBACK,
      input: {
        prompt: finalPrompt,
        output_format: "png",
        image_size,
        task_type: "image_edit" as const,
        image_urls: [uploadedUrl],
      },
    };

    try { console.debug("[KIE][persona-upload] payload", { model: payload.model, input: { ...payload.input, image_urls: ["<redacted>"] } }); } catch {}

    const createRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const createJson = await createRes.json().catch(() => ({}));
    try { console.debug("[KIE][persona-upload] response", { status: createRes.status, ok: createRes.ok, body: createJson }); } catch {}

    if (!createRes.ok || createJson?.code !== 200) {
      return NextResponse.json(
        { ok: false, error: `Create task failed: ${createJson?.msg || createRes.status}`, raw: createJson, modelUsed: EDIT_MODEL },
        { status: 502 }
      );
    }

    const taskId: string | undefined = createJson?.data?.taskId;
    if (!taskId) return NextResponse.json({ ok: false, error: "Missing taskId in response", raw: createJson }, { status: 502 });

    await chargeCredits(gate.auth.supabase, gate.cost, "Image generation");

    return NextResponse.json({ ok: true, taskId, modelUsed: EDIT_MODEL, uploadedUrl });
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
