# Deploying the joiner on Google Cloud Run

Cheaper than an always-on box because it **scales to zero** — you're billed per
100ms while a film is actually being joined, and nothing at all in between.

One 10-shot HD join is roughly 30 seconds of compute, so about **$0.0008**.
A thousand films a month is under a dollar, and Cloud Run's free tier covers
early volume outright.

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT

gcloud run deploy homereel-joiner \
  --source . \
  --region australia-southeast1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 600 \
  --max-instances 5 \
  --min-instances 0            # scale to zero: this is the whole point
```

It reads the Dockerfile in this directory. Nothing about the service changes.

**Why these flags**

- `--memory 2Gi` — ffmpeg holds several 1080p clips at once. 512Mi will OOM on
  a long film, and the failure looks like a random 500.
- `--timeout 600` — the default 300s is fine for ten shots but not for thirty.
- `--min-instances 0` — you pay nothing when nobody is making a film. A cold
  start adds a few seconds to the first join, which is invisible next to the
  20 seconds the join itself takes.
- `--max-instances 5` — a cap so a runaway loop can't run up a bill.

## Alternatives, honestly

| | cost | catch |
|---|---|---|
| **Cloud Run** | ~$0 at low volume | needs a Google Cloud account |
| **Fly.io** (auto-stop machines) | ~$0–2/mo | still a small monthly floor |
| **Render free tier** | $0 | sleeps after 15 min; ~50s cold start on the first film |
| **Render starter** | $7/mo | always warm, nothing to think about |
| **ffmpeg.wasm in the browser** | $0, no server | 3–7 min per film, falls over on memory at 1080p |
| **Hard cuts, no dissolves** | $0 | loses the dissolve, which is part of why it doesn't read as a slideshow |
