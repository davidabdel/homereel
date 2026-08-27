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
    const productFile = form.get("file"); // Primary file (product)
    const personaFile = form.get("secondaryFile"); // Secondary file (persona)
    const prompt = (form.get("prompt") as string) || "";
    const personaSummary = (form.get("personaSummary") as string) || "";
    const aspectRatio = (form.get("aspectRatio") as string) || "16:9";
    const personaMode = (form.get("personaMode") as string) || "";

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";
    const EDIT_MODEL = env("KIE_NANO_EDIT_MODEL") ?? "google/nano-banana-edit"; // Always use edit model
    const CALLBACK = env("KIE_CALLBACK_URL");
    const KIE_UPLOAD_BASE = env("KIE_UPLOAD_BASE") ?? "https://kieai.redpandaai.co";

    if (!KIE_API_KEY) {
      return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });
    }

    if (!(productFile instanceof File)) {
      return NextResponse.json({ ok: false, error: "Product image file is required" }, { status: 400 });
    }

    const image_size = ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";

    // Upload product image
    let productUrl: string | undefined;
    let personaUrl: string | undefined;

    // Upload product image
    try {
      const fd = new FormData();
      fd.append("file", productFile);
      fd.append("uploadPath", "ugc-factory");
      fd.append("fileName", (productFile as File).name);
      const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
        body: fd,
      });
      const upJson = await upRes.json();
      if (upRes.ok && (upJson?.success || upJson?.code === 200)) {
        productUrl = upJson?.data?.fileUrl || upJson?.data?.url || upJson?.data?.downloadUrl;
      }
    } catch {}

    if (!productUrl) {
      try {
        const arr = await (productFile as File).arrayBuffer();
        const b64 = Buffer.from(arr).toString("base64");
        const payload = {
          fileBase64: `data:${(productFile as File).type || "image/jpeg"};base64,${b64}`,
          uploadPath: "ugc-factory",
          fileName: (productFile as File).name || "upload.jpg",
        };
        const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const upJson = await upRes.json();
        if (upRes.ok && (upJson?.success || upJson?.code === 200)) {
          productUrl = upJson?.data?.fileUrl || upJson?.data?.url || upJson?.data?.downloadUrl;
        }
      } catch {}
    }

    if (!productUrl) {
      return NextResponse.json({ ok: false, error: "Failed to upload product image" }, { status: 500 });
    }

    // Process persona file if provided
    if (personaFile instanceof File) {
      // Only accept JPG/PNG files directly
      const fileType = (personaFile as File).type || "";
      if (!/^image\/(jpeg|png|jpg|webp)/i.test(fileType)) {
        return NextResponse.json(
          { ok: false, error: "Only JPG, PNG and WebP files are supported for persona images" },
          { status: 400 }
        );
      }

      // Upload persona image
      try {
        const fd = new FormData();
        fd.append("file", personaFile);
        fd.append("uploadPath", "ugc-factory");
        fd.append("fileName", (personaFile as File).name);
        const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-stream-upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${KIE_API_KEY}` },
          body: fd,
        });
        const upJson = await upRes.json();
        if (upRes.ok && (upJson?.success || upJson?.code === 200)) {
          personaUrl = upJson?.data?.fileUrl || upJson?.data?.url || upJson?.data?.downloadUrl;
        }
      } catch {}

      if (!personaUrl) {
        try {
          const arr = await (personaFile as File).arrayBuffer();
          const b64 = Buffer.from(arr).toString("base64");
          const payload = {
            fileBase64: `data:${(personaFile as File).type || "image/jpeg"};base64,${b64}`,
            uploadPath: "ugc-factory",
            fileName: (personaFile as File).name || "upload.jpg",
          };
          const upRes = await fetch(`${KIE_UPLOAD_BASE}/api/file-base64-upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const upJson = await upRes.json();
          if (upRes.ok && (upJson?.success || upJson?.code === 200)) {
            personaUrl = upJson?.data?.fileUrl || upJson?.data?.url || upJson?.data?.downloadUrl;
          }
        } catch {}
      }

      if (!personaUrl) {
        return NextResponse.json({ ok: false, error: "Failed to upload persona image" }, { status: 500 });
      }
    }

    // Build final prompt
    const personText = personaSummary || "";
    const finalPrompt = `${prompt} ${personText ? `Person description: ${personText}` : ""}`.trim();

    // Prepare image URLs array
    const imageUrls = [productUrl];
    if (personaUrl) {
      imageUrls.push(personaUrl);
    }

    const payload = {
      model: EDIT_MODEL,
      callBackUrl: CALLBACK,
      input: {
        prompt: finalPrompt,
        output_format: "png",
        image_size,
        task_type: "image_edit",
        image_urls: imageUrls,
      },
    };

    try {
      console.debug("[KIE][ugc-product] payload", { 
        model: payload.model, 
        input: {
          ...payload.input,
          image_urls: payload.input.image_urls ? `[${payload.input.image_urls.length} URLs]` : undefined 
        }
      });
    } catch {}

    const createRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const createJson = await createRes.json().catch(() => ({}));
    try { 
      console.debug("[KIE][ugc-product] response", { 
        status: createRes.status, 
        ok: createRes.ok, 
        body: createJson 
      }); 
    } catch {}

    if (!createRes.ok || createJson?.code !== 200) {
      return NextResponse.json(
        { 
          ok: false, 
          error: `Create task failed: ${createJson?.msg || createRes.status}`, 
          raw: createJson, 
          modelUsed: EDIT_MODEL, 
          hadProductUrl: Boolean(productUrl),
          hadPersonaUrl: Boolean(personaUrl),
          personaMode
        },
        { status: 502 }
      );
    }

    const taskId: string | undefined = createJson?.data?.taskId;
    if (!taskId) return NextResponse.json({ ok: false, error: "Missing taskId in response", raw: createJson }, { status: 502 });

    await chargeCredits(gate.auth.supabase, gate.cost, "Image generation");

    return NextResponse.json({ ok: true, taskId, modelUsed: EDIT_MODEL });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
