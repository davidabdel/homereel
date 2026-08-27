// Legacy endpoint kept for backward compatibility with earlier client that called /api/generate-image directly.
import { NextResponse } from "next/server";
import { authorizeGeneration, chargeCredits } from "@/lib/api-guard";

export const runtime = "nodejs"; // Buffer support

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
    const aspectRatio = (form.get("aspectRatio") as string) || "16:9";

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";
    const MODEL = env("KIE_NANO_MODEL") ?? "google/nano-banana-edit";
    const EDIT_MODEL = env("KIE_NANO_EDIT_MODEL") ?? "google/nano-banana-edit";
    const CALLBACK = env("KIE_CALLBACK_URL");
    const KIE_UPLOAD_BASE = env("KIE_UPLOAD_BASE") ?? "https://kieai.redpandaai.co";

    // If no key, gracefully fall back: echo uploaded image if provided
    if (!KIE_API_KEY) {
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = file.type || "image/png";
        const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
        return NextResponse.json({ ok: true, provider: "mock", imageUrl: dataUrl, prompt, aspectRatio });
      }
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    // Map aspect ratio to image_size. If not one of expected values, use "auto".
    const image_size = ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";

    // If we have a file, upload it to Kie to obtain a public URL
    let uploadedUrl: string | undefined;
    if (file instanceof File) {
      // Try stream upload first
      try {
        const streamFd = new FormData();
        streamFd.append("file", file);
        streamFd.append("uploadPath", "ugc-factory");
        streamFd.append("fileName", file.name);
        const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
          body: streamFd,
        });
        const upJson = await upRes.json();
        if (upRes.ok && (upJson?.success || upJson?.code === 200)) {
          uploadedUrl = upJson?.data?.fileUrl || upJson?.data?.url || upJson?.data?.downloadUrl;
        }
      } catch {}
      // Fallback to base64 upload
      if (!uploadedUrl) {
        try {
          const arr = await file.arrayBuffer();
          const b64 = Buffer.from(arr).toString("base64");
          const base64Payload = {
            fileBase64: `data:${file.type || "image/png"};base64,${b64}`,
            uploadPath: "ugc-factory",
            fileName: file.name,
          } as any;
          const upRes2 = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${KIE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(base64Payload),
          });
          const upJson2 = await upRes2.json();
          if (upRes2.ok && (upJson2?.success || upJson2?.code === 200)) {
            uploadedUrl = upJson2?.data?.fileUrl || upJson2?.data?.url || upJson2?.data?.downloadUrl;
          }
        } catch {}
      }
    }

    // Choose an edit model if a file is provided; fall back to MODEL otherwise
    const modelToUse = (file instanceof File)
      ? (EDIT_MODEL || (MODEL.endsWith("-edit") ? MODEL : `${MODEL}-edit`))
      : MODEL;

    // Simple heuristic: if prompt asks to remove background, pass an explicit flag if supported
    const removeBg = typeof prompt === "string" && /remove\s+the?\s*background/i.test(prompt);

    const payload = {
      model: modelToUse,
      callBackUrl: CALLBACK,
      input: {
        prompt,
        output_format: "png",
        image_size,
        ...(file instanceof File ? { task_type: "image_edit" as const } : {}),
        ...(removeBg ? { remove_background: true } : {}),
        ...(uploadedUrl ? { image_urls: [uploadedUrl] } : {}),
      },
    };

    // Server-side diagnostic (safe) logging
    try {
      console.debug("[KIE] legacy createTask payload", {
        model: payload.model,
        hasCallback: Boolean(payload.callBackUrl),
        input: { ...payload.input, image_urls: payload.input?.image_urls ? ["<redacted>"] : undefined },
      });
    } catch {}

    const createRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const createJson = await createRes.json().catch(() => ({}));
    try {
      console.debug("[KIE] legacy createTask response", { status: createRes.status, ok: createRes.ok, body: createJson });
    } catch {}
    if (!createRes.ok || createJson?.code !== 200) {
      return NextResponse.json({ ok: false, error: `Create task failed: ${createJson?.msg || createRes.status}` }, { status: 502 });
    }

    const taskId: string | undefined = createJson?.data?.taskId;
    if (!taskId) {
      return NextResponse.json({ ok: false, error: "Missing taskId in response" }, { status: 502 });
    }

    // Poll recordInfo (Kie docs show camelCase; some pages show dashed). We'll try camelCase first, then dashed if 404.
    const start = Date.now();
    const timeoutMs = 70000; // 70 seconds
    let imageUrl: string | null = null;
    let lastPayload: any = null;
    while (Date.now() - start < timeoutMs) {
      let infoRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
        headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
      });
      // If not found, try dashed variant
      if (infoRes.status === 404) {
        infoRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/record-info?taskId=${encodeURIComponent(taskId)}`, {
          headers: { "Authorization": `Bearer ${KIE_API_KEY}` },
        });
      }
      const infoJson = await infoRes.json().catch(() => ({}));
      lastPayload = infoJson;
      if (infoRes.ok && infoJson?.code === 200) {
        const data = infoJson.data;
        const flag = data?.successFlag; // 0 processing, 1 success, 2 failed
        if (flag === 1) {
          const urls: string[] | undefined = data?.response?.result_urls;
          if (urls && urls.length > 0) {
            imageUrl = urls[0];
          }
          break;
        }
        if (flag === 2) {
          return NextResponse.json({ ok: false, error: data?.errorMessage || "Generation failed", raw: infoJson }, { status: 502 });
        }
      }
      // wait 1s between polls
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!imageUrl) {
      return NextResponse.json({ ok: false, error: "Timed out waiting for image", taskId, raw: lastPayload }, { status: 504 });
    }

    await chargeCredits(gate.auth.supabase, gate.cost, "Image generation");

    return NextResponse.json({ ok: true, provider: "kie", imageUrl, taskId });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
