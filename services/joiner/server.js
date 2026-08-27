/**
 * HomeReel joiner — takes the approved shots and returns one film.
 *
 * This is plain ffmpeg. It lives in its own container purely because ffmpeg is
 * a binary that needs a filesystem, and neither Vercel functions nor Cloudflare
 * Workers give you one. Nothing clever happens here.
 *
 * POST /join
 *   { "shots": ["https://…/1.mp4", …], "crossfade": 0.3, "grade": true }
 *   -> video/mp4
 *
 * Measured on a 10-shot 1080p film: hard cuts 0.3s, 0.3s crossfades ~21s.
 */

import express from "express";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const run = promisify(execFile);
const app = express();
app.use(express.json({ limit: "1mb" }));

const MAX_SHOTS = 40;
const FETCH_TIMEOUT_MS = 60_000;
const XFADE_DEFAULT = 0.3;

/** Post-only grade. Never invent light — a property's aspect is a real claim. */
const GRADE = "eq=contrast=1.04:saturation=1.05,colorbalance=rs=0.015:gs=0.005:bs=-0.015";

app.get("/health", (_req, res) => res.json({ ok: true }));

async function duration(path) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path,
  ]);
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`could not read duration of ${path}`);
  return d;
}

/**
 * Download one shot.
 *
 * The body has to be consumed or explicitly cancelled on every path. Leaving a
 * fetch body dangling after an error crashes the process from inside undici
 * ("assert(!this.paused)") rather than just failing the request — so one bad
 * URL would take the service down for everybody. Found that by pointing it at
 * a host that wasn't listening.
 */
async function fetchTo(url, dest) {
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(`could not reach ${url}: ${e?.message || e}`);
  }
  if (!r.ok) {
    await r.body?.cancel().catch(() => {});
    throw new Error(`fetch ${r.status} for ${url}`);
  }
  if (!r.body) throw new Error(`empty body for ${url}`);
  try {
    await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
  } catch (e) {
    await r.body.cancel().catch(() => {});
    throw new Error(`download failed for ${url}: ${e?.message || e}`);
  }
}

app.post("/join", async (req, res) => {
  const shots = Array.isArray(req.body?.shots) ? req.body.shots : [];
  const xfade = Number(req.body?.crossfade ?? XFADE_DEFAULT);
  const grade = req.body?.grade !== false;

  if (shots.length === 0) return res.status(400).json({ error: "no shots" });
  if (shots.length > MAX_SHOTS) return res.status(400).json({ error: `max ${MAX_SHOTS} shots` });
  if (shots.some((s) => typeof s !== "string" || !/^https?:\/\//i.test(s))) {
    return res.status(400).json({ error: "every shot must be an http(s) url" });
  }

  const dir = await mkdtemp(join(tmpdir(), "homereel-"));
  try {
    const files = [];
    for (let i = 0; i < shots.length; i++) {
      const f = join(dir, `in_${String(i).padStart(3, "0")}.mp4`);
      await fetchTo(shots[i], f);
      files.push(f);
    }

    const out = join(dir, "film.mp4");
    const started = Date.now();

    if (files.length === 1) {
      // Nothing to join. Re-encode only if a grade was asked for.
      const args = grade
        ? ["-y", "-i", files[0], "-vf", GRADE, "-an", "-c:v", "libx264", "-crf", "20",
           "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
        : ["-y", "-i", files[0], "-c", "copy", "-movflags", "+faststart", out];
      await run("ffmpeg", args, { maxBuffer: 1 << 26 });
    } else if (xfade <= 0) {
      // Hard cuts: stream copy, effectively instant.
      const list = join(dir, "list.txt");
      await writeFile(list, files.map((f) => `file '${f}'`).join("\n"));
      await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list,
                           "-c", "copy", "-movflags", "+faststart", out], { maxBuffer: 1 << 26 });
    } else {
      // Dissolves. Each xfade offset is cumulative: every join eats `xfade`
      // seconds of the running total, so the offsets have to be built from the
      // already-shortened timeline rather than raw start times.
      const durations = [];
      for (const f of files) durations.push(await duration(f));

      const inputs = files.flatMap((f) => ["-i", f]);
      const chain = [];
      let prev = "0:v";
      let offset = 0;
      for (let i = 1; i < files.length; i++) {
        offset += durations[i - 1] - xfade;
        const label = `v${i}`;
        chain.push(
          `[${prev}][${i}:v]xfade=transition=fade:duration=${xfade}:offset=${offset.toFixed(3)}[${label}]`
        );
        prev = label;
      }
      if (grade) {
        chain.push(`[${prev}]${GRADE}[out]`);
        prev = "out";
      }
      await run("ffmpeg", ["-y", ...inputs, "-filter_complex", chain.join(";"),
                           "-map", `[${prev}]`, "-an", "-c:v", "libx264", "-crf", "20",
                           "-preset", "medium", "-pix_fmt", "yuv420p",
                           "-movflags", "+faststart", out], { maxBuffer: 1 << 26 });
    }

    const { size } = await stat(out);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(size));
    res.setHeader("X-Join-Seconds", ((Date.now() - started) / 1000).toFixed(1));
    res.setHeader("X-Shot-Count", String(files.length));
    await pipeline(createReadStream(out), res);
  } catch (err) {
    console.error("[join]", err);
    if (!res.headersSent) res.status(500).json({ error: String(err?.message || err) });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Last resort. Everything above is meant to handle its own failures, but a
// video service dying on one bad request would take every other agent's film
// with it, so log loudly and stay up rather than exit.
process.on("uncaughtException", (err) => console.error("[uncaught]", err));
process.on("unhandledRejection", (err) => console.error("[unhandled]", err));

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`joiner listening on ${port}`));
