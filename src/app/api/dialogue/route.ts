import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  return process.env[name];
}

type Mode = "assist" | "shorten" | "cleanup";

export async function POST(req: Request) {
  try {
    if (!(await getRouteUser())) return unauthorized();

    const { mode, text, accent, gender, context } = await req.json().catch(() => ({}));
    if (!mode || !["assist", "shorten", "cleanup"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    const OPENAI_API_KEY = env("OPENAI_API_KEY");
    const OPENAI_MODEL = env("OPENAI_MODEL") || "gpt-4o-mini"; // fast, good quality
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    // Build task-specific instruction
    const constraints = `Respond with ONLY the dialogue line. Keep it natural, friendly and conversational. Max 22 words AND 150 characters. No quotes, no markdown, no extra commentary.`;

    let userInstruction = "";
    switch (mode as Mode) {
      case "assist":
        userInstruction = `Create a single 8-second product ad dialogue line. ${constraints}`;
        break;
      case "shorten":
        userInstruction = `Rewrite the provided line so it fits within the limits. Preserve meaning and tone. ${constraints}`;
        break;
      case "cleanup":
        userInstruction = `Polish grammar and clarity while staying within limits. Preserve meaning and tone. ${constraints}`;
        break;
    }

    const hints: string[] = [];
    if (accent) hints.push(`Accent: ${accent}`);
    if (gender) hints.push(`Voice: ${gender}`);
    if (context) hints.push(`Context: ${context}`);

    // Compose a single input string per Responses API
    const input = [
      "System: You are a concise advertising copywriter for short 8-second UGC-style lines. Always obey the word (<=22) and character (<=150) limits and output plain text only.",
      `Task: ${userInstruction}`,
      hints.length ? `Hints: ${hints.join("; ")}` : "",
      text ? `Original: ${text}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input,
        temperature: mode === "cleanup" ? 0.3 : 0.7,
        max_output_tokens: 120,
      }),
    });

    const textBody = await res.text();
    let json: any = {};
    try { json = JSON.parse(textBody); } catch {}
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || textBody || `OpenAI error ${res.status}`;
      try { console.error("[OpenAI] error", { status: res.status, body: json || textBody }); } catch {}
      return NextResponse.json({ ok: false, error: msg, raw: json || textBody }, { status: 502 });
    }

    // Try several shapes returned by different models/endpoints
    let textOut: string | undefined = (json?.output_text || "").trim();
    if (!textOut && Array.isArray(json?.choices) && json.choices[0]?.message?.content) {
      textOut = String(json.choices[0].message.content).trim();
    }
    if (!textOut && Array.isArray(json?.output)) {
      try {
        const pieces: string[] = [];
        for (const item of json.output) {
          const content = item?.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              if (typeof c?.text === "string") pieces.push(c.text);
              if (typeof c?.string_value === "string") pieces.push(c.string_value);
            }
          }
        }
        if (pieces.length) textOut = pieces.join(" ").trim();
      } catch {}
    }
    if (!textOut) {
      return NextResponse.json({ ok: false, error: "No content returned from OpenAI", raw: json }, { status: 502 });
    }

    // Enforce hard caps just in case
    const words = textOut.trim().split(/\s+/).length;
    const clipped = textOut.slice(0, 150);
    const final = words <= 22 ? clipped : clipped.split(/\s+/).slice(0, 22).join(" ");

    return NextResponse.json({ ok: true, text: final });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}

// Simple GET ping for diagnostics: /api/dialogue?ping=1
export async function GET(req: Request) {
  try {
    if (!(await getRouteUser())) return unauthorized();

    const { searchParams } = new URL(req.url);
    if (searchParams.get("ping")) {
      const hasKey = Boolean(env("OPENAI_API_KEY"));
      const model = env("OPENAI_MODEL") || "gpt-4o-mini";
      return NextResponse.json({ ok: true, hasKey, model });
    }
    return NextResponse.json({ ok: false, error: "Use POST for dialogue or ?ping=1 for diagnostics" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
