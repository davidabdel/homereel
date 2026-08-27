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

    // Try Veo-specific endpoints first, then fall back to generic jobs recordInfo
    const endpoints = [
      // KIE docs recommend this endpoint
      `/api/v1/veo/record-info`,
      // Possible casing variants and other Veo endpoints
      `/api/v1/veo/recordInfo`,
      `/api/v1/veo/get`,
      `/api/v1/veo/detail`,
      `/api/v1/veo/details`,
      `/api/v1/veo/getVideo`,
      `/api/v1/veo/getVideoDetails`,
      // Generic job record info
      `/api/v1/jobs/recordInfo`,
      `/api/v1/jobs/record-info`,
    ];
    let infoRes: Response | null = null;
    let infoJson: any = null;
    for (const ep of endpoints) {
      const url = `${KIE_API_BASE}${ep}?taskId=${encodeURIComponent(taskId)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${KIE_API_KEY}` } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        infoRes = r; infoJson = j; break;
      }
      // If 404 or 422, keep trying next
    }
    if (!infoRes) {
      return NextResponse.json({ ok: false, error: "All status endpoints failed", tried: endpoints }, { status: 502 });
    }

    // Normalize a few fields
    const data: any = (infoJson && (infoJson.data || infoJson)) || {};
    const response: any = data.response || infoJson.response || {};
    const state: string | undefined = data.state || infoJson.state || data.status || infoJson.status;
    let flag: number | undefined = data.successFlag;
    if (state === "success") flag = 1;
    if (state === "failed" || state === "error") flag = 2;
    if (typeof data.status === "number") {
      if (data.status === 1) flag = 1; // success
      if (data.status === 2 || data.status === 3) flag = 2; // failed
    }
    // Normalize KIE successFlag semantics: 0 generating, 1 success, 2/3 failed
    if (flag === 3) flag = 2;
    // Progress can come in many shapes: 0..1, 0..100, string "65%", fields like percent/percentage/progressPercent
    let progress: number | undefined = undefined;
    const progressRaw: any =
      data.progress ?? response.progress ?? infoJson.progress ??
      data.percent ?? response.percent ?? infoJson.percent ??
      data.percentage ?? response.percentage ?? infoJson.percentage ??
      data.progressPercent ?? response.progressPercent ?? infoJson.progressPercent;
    if (typeof progressRaw === "number") progress = progressRaw > 1 ? progressRaw / 100 : progressRaw;
    if (typeof progressRaw === "string") {
      const n = Number(String(progressRaw).replace(/%$/, ""));
      if (!Number.isNaN(n)) progress = n > 1 ? n / 100 : n;
    }

    // Collect URLs from common fields
    let urls: string[] = (response.result_urls || response.resultUrls || response.videos || response.urls || []) as string[];
    // Additional common places
    const extras: (string | undefined)[] = [
      data.videoUrl, data.url, response.videoUrl, response.url,
      data.downloadUrl, response.downloadUrl,
    ];
    urls = urls.concat(extras.filter((u): u is string => typeof u === "string"));
    try {
      const rj = data.resultJson || infoJson.resultJson;
      if (typeof rj === "string" && rj.trim().startsWith("{")) {
        const parsed = JSON.parse(rj);
        if (Array.isArray(parsed?.resultUrls)) urls = [...urls, ...parsed.resultUrls];
        if (typeof parsed?.url === "string") urls = [...urls, parsed.url];
        if (typeof parsed?.videoUrl === "string") urls = [...urls, parsed.videoUrl];
      }
    } catch {}
    // Deduplicate
    urls = Array.from(new Set(urls.filter((u) => typeof u === "string" && u)));

    // Human-friendly stage message if provided
    const stage: string | undefined = data.stage || response.stage || data.step || response.step || data.message || response.message;

    return NextResponse.json({ ...infoJson, normalized: { flag, progress, urls, state, stage } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unknown error" }, { status: 500 });
  }
}
