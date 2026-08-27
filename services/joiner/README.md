# HomeReel joiner

Takes the shots the agent approved and returns one film.

It's ordinary ffmpeg. It only exists as a separate service because ffmpeg is a
binary that needs a filesystem, and neither Vercel functions nor Cloudflare
Workers provide one.

```
POST /join
{ "shots": ["https://…/1.mp4", …], "crossfade": 0.3, "grade": true }
-> video/mp4
```

`crossfade: 0` uses hard cuts and a stream copy, which is effectively free.
Anything above 0 dissolves and re-encodes.

Measured on a ten-shot 1080p film: **hard cuts 0.3s, 0.3s dissolves ~21s.**

## Notes

- Every fetch body is consumed or explicitly cancelled. Leaving one dangling
  after an error crashes the process from inside undici rather than failing the
  one request — so a single unreachable shot URL would take the service down
  for every other agent. There's a top-level handler as a second net.
- The grade is `eq` + `colorbalance` only. Never invent light: a property's
  aspect is a real claim about the house.
- `xfade` offsets are cumulative — each join eats `crossfade` seconds from the
  running total, so offsets are built from the shortened timeline, not raw
  start times. Getting this wrong makes the last shots drift out of sync.

## Local

```bash
npm install && PORT=8099 npm start
curl localhost:8099/health
```
