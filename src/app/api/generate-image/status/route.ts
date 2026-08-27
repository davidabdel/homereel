import { NextResponse } from "next/server";
import { getRouteUser, unauthorized } from "@/lib/api-guard";

export const runtime = "nodejs";

function env(name: string) {
  return process.env[name];
}

export async function GET(req: Request) {
  try {
    if (!(await getRouteUser())) return unauthorized();

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ ok: false, error: "Missing taskId" }, { status: 400 });

    const KIE_API_KEY = env("KIE_API_KEY");
    const KIE_API_BASE = env("KIE_API_BASE") ?? "https://api.kie.ai";

    if (!KIE_API_KEY) return NextResponse.json({ ok: false, error: "KIE_API_KEY not configured" }, { status: 500 });

    // Try camelCase first, then dashed path if 404
    let infoRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${KIE_API_KEY}` },
    });
    if (infoRes.status === 404) {
      infoRes = await fetch(`${KIE_API_BASE}/api/v1/jobs/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
    }

    const infoJson = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok) return NextResponse.json({ ok: false, error: `Status error ${infoRes.status}`, raw: infoJson }, { status: 502 });

    // Normalize diverse KIE response shapes for client convenience
    const data = (infoJson && (infoJson.data || infoJson)) || {};
    const response = data.response || infoJson.response || {};
    // Determine success flag
    let flag: number | undefined = data.successFlag;
    const state: string | undefined = data.state || infoJson.state;
    if (state === "success") flag = 1;
    if (state === "failed" || state === "error") flag = 2;
    if (flag === undefined) {
      // Heuristic: if result URLs are present, mark as success
      const anyUrls = response.result_urls || response.resultUrls || response.images || response.urls;
      if (Array.isArray(anyUrls) && anyUrls.length > 0) flag = 1;
    }
    // Normalize progress to 0..1 if possible
    let progressRaw: any = data.progress ?? response.progress ?? infoJson.progress;
    let progress: number | undefined = undefined;
    if (typeof progressRaw === "number") {
      progress = progressRaw > 1 ? progressRaw / 100 : progressRaw;
    } else if (typeof progressRaw === "string") {
      const n = Number(progressRaw.replace(/%$/, ""));
      if (!Number.isNaN(n)) progress = n > 1 ? n / 100 : n;
    }
    // Collect possible result URLs
    let urls: string[] = (
      response.result_urls || response.resultUrls || response.images || response.urls || []
    ) as string[];
    // KIE may return resultJson as a string containing { resultUrls: [...] }
    try {
      const rj = data.resultJson || infoJson.resultJson;
      if (typeof rj === "string" && rj.trim().startsWith("{")) {
        const parsed = JSON.parse(rj);
        if (Array.isArray(parsed?.resultUrls)) {
          urls = [...urls, ...parsed.resultUrls.filter((u: any) => typeof u === "string")];
        }
      }
    } catch {}

    const enriched = { ...infoJson, normalized: { flag, progress, urls, state } };
    try {
      console.debug("[KIE] status normalized", { flag, progress, urlsCount: Array.isArray(urls) ? urls.length : 0 });
    } catch {}

    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
