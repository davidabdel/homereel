import { NextResponse } from "next/server";
import { authorizeGeneration, chargeCredits } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  return process.env[name];
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
    const personaMode = (form.get("personaMode") as string) || ""; // "upload" | "generate" | ""

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";
    const MODEL = env("KIE_NANO_MODEL") ?? "google/nano-banana";
    const EDIT_MODEL = env("KIE_NANO_EDIT_MODEL") ?? "google/nano-banana-edit";
    const CALLBACK = env("KIE_CALLBACK_URL");
    const KIE_UPLOAD_BASE = env("KIE_UPLOAD_BASE") ?? "https://kieai.redpandaai.co";

    // If no key, gracefully return the uploaded image preview so UI remains usable
    if (!KIE_API_KEY) {
      if (file instanceof File) {
        const arr = await file.arrayBuffer();
        const buf = Buffer.from(arr);
        const mime = file.type || "image/png";
        return NextResponse.json({ ok: true, imageUrl: `data:${mime};base64,${buf.toString("base64")}` });
      }
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    // Map aspect ratio to image_size or use auto
    const image_size = ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";

    // Upload image to Kie to obtain a URL
    let uploadedUrl: string | undefined;
    // Only attempt upload when NOT in persona generate mode
    const allowUpload = personaMode !== "generate";
    if (allowUpload && file instanceof File) {
      // If HEIC/HEIF, convert to JPEG server-side using sharp
      let workingFile: File = file;
      const isHeic = /heic|heif/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");
      if (isHeic) {
        try {
          const sharp = (await import("sharp")).default;
          const inputBuf = Buffer.from(await file.arrayBuffer());
          const outBuf = await sharp(inputBuf).jpeg({ quality: 90 }).toBuffer();
          const outName = (file.name || "upload").replace(/\.(heic|heif)$/i, ".jpg");
          // Copy into a fresh ArrayBuffer to satisfy File/Blob typing
          const ab = new ArrayBuffer(outBuf.byteLength);
          new Uint8Array(ab).set(outBuf);
          workingFile = new File([ab], outName, { type: "image/jpeg" });
        } catch (err) {
          // If conversion fails (e.g. sharp not installed), return a clear error
          return NextResponse.json(
            { ok: false, error: "HEIC/HEIF conversion failed; please install sharp or upload PNG/JPG/WebP" },
            { status: 500 }
          );
        }
      }
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
          // Use the working file (possibly converted) for base64 upload
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
    }

    // Explicit persona-driven model selection:
    // - If user chose to upload a reference on Persona step → use edit model
    // - If user chose to generate persona (no reference) → use base model
    // - Fallback: if personaMode is missing, keep previous heuristic by file presence
    const modelToUse = personaMode === "upload"
      ? (EDIT_MODEL || (MODEL.endsWith("-edit") ? MODEL : `${MODEL}-edit`))
      : personaMode === "generate"
        ? MODEL
        : ((file instanceof File)
            ? (EDIT_MODEL || (MODEL.endsWith("-edit") ? MODEL : `${MODEL}-edit`))
            : MODEL);

    // Simple heuristic: if prompt asks to remove background, pass an explicit flag if supported
    const removeBg = typeof prompt === "string" && /remove\s+the?\s*background/i.test(prompt);

    // Compose final prompt. If we have an uploaded image URL, embed it per user's instruction
    // Format: "Generate this image {URL} and generate this person {PROMPT}".
    // Use the user's Generate Image prompt; if empty, fall back to personaSummary.
    let finalPrompt = prompt;
    if (uploadedUrl) {
      const personText = (prompt && prompt.trim()) ? prompt.trim() : (personaSummary || "");
      finalPrompt = personText
        ? `Generate this image ${uploadedUrl} and generate this person ${personText}`
        : `Generate this image ${uploadedUrl}`;
    }

    const payload = {
      model: modelToUse,
      callBackUrl: CALLBACK,
      input: {
        prompt: finalPrompt,
        output_format: "png",
        image_size,
        // Do not mark as edit task when personaMode === 'generate'
        ...(allowUpload && file instanceof File ? { task_type: "image_edit" as const } : {}),
        ...(removeBg ? { remove_background: true } : {}),
        ...(uploadedUrl ? { image_urls: [uploadedUrl] } : {}),
      },
    };

    // Server-side diagnostic (safe) logging
    try {
      console.debug("[KIE] createTask payload", {
        model: payload.model,
        hasCallback: Boolean(payload.callBackUrl),
        input: { ...payload.input, image_urls: payload.input?.image_urls ? ["<redacted>"] : undefined },
      });
    } catch {}

    const createRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const createJson = await createRes.json().catch(() => ({}));
    try {
      console.debug("[KIE] createTask response", { status: createRes.status, ok: createRes.ok, body: createJson });
    } catch {}
    if (!createRes.ok || createJson?.code !== 200) {
      return NextResponse.json({ ok: false, error: `Create task failed: ${createJson?.msg || createRes.status}`, raw: createJson, modelUsed: modelToUse, hadUploadUrl: Boolean(uploadedUrl), personaMode, hadFile: file instanceof File, allowUpload }, { status: 502 });
    }
    const taskId: string | undefined = createJson?.data?.taskId;
    if (!taskId) {
      return NextResponse.json({ ok: false, error: "Missing taskId in response", raw: createJson }, { status: 502 });
    }

    await chargeCredits(gate.auth.supabase, gate.cost, "Image generation");

    return NextResponse.json({ ok: true, taskId, uploadedUrl, modelUsed: modelToUse });
  } catch (err: unknown) {
    const message = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
