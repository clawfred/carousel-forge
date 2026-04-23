# carousel-forge

Local web tool for fan-out carousel slide generation. Kerem-only. Reads your 4 reference slides + the locked master prompt, fires parallel image-gen calls, saves the outputs to `renders/<carousel-slug>/slides/01.png…N.png` so you can drag them straight into Instagram and TikTok.

## Setup (one time)

```sh
cd marketing/carousel-forge
npm install
cp .env.example .env
# Edit .env — set PROVIDER and paste your key(s)
```

Node 20+ required.

### Which provider?

| | `PROVIDER=xai` (Grok) | `PROVIDER=openai` (gpt-image-1) |
|---|---|---|
| Multi-ref | up to 5 | up to 16 |
| 4:5 portrait | renders at 3:4, tool center-crops to 4:5 | renders at 1024×1536 (2:3), tool center-crops to 4:5 |
| Primary endpoint | `/v1/images/edits` | `/v1/images/edits` |
| Notes | Grok's multi-image payload shape is inferred (docs don't show an explicit multi-ref example). If Grok rejects the array, switch `PROVIDER=openai` in `.env` and restart. | Strongest instruction-following. Slower. |

Default is `xai`.

## Run

```sh
npm start
```

Open the URL it prints (default `http://localhost:4321`).

## Flow

1. **Name the carousel** (e.g. `carousel-01-accent-myth`). The slug determines the output folder.
2. **Drop references** (up to 5) — the locked editorial examples you want Grok to match.
3. **Load default master prompt** (or edit). The default is the super-short palette-flex prompt.
4. **Load Carousel #1 preset** to pre-fill all 10 slide texts. Or paste your own.
5. **Preview slide 1.** If it looks right, click **generate 2-N** to fan out the rest in parallel. If it's off, tweak the master prompt and preview again — you haven't burned 10 renders on a bad prompt.
6. **Open the folder** on disk: `marketing/carousel-forge/renders/<slug>/slides/` — files are `01.png`, `02.png`, … ready to post.

## Files on disk

```
renders/<slug>/
  refs/           — uploaded reference images (ref-01.jpg…)
  slides/         — rendered outputs (01.png, 02.png, …)
  master-prompt.txt
  slides.json
```

All outputs center-cropped to 4:5 (Instagram portrait max).

## Regenerating one slide

Each slide row has its own **generate** button. Click it anytime — the output at that slide number gets overwritten.

## Troubleshooting

- **"xAI 400: invalid image field"** — Grok may not accept the inferred array shape. Switch `PROVIDER=openai` and restart.
- **Grok outputs look too close to one reference** — Grok's edit endpoint may be biasing toward the first image. Try reducing refs to the 2-3 most representative ones.
- **Cropped output looks tight** — 4:5 crop is center-based. If key content is top or bottom-weighted, bump `GROK_ASPECT_RATIO=9:16` in `.env` for a taller render with more crop slack.
- **Port 4321 in use** — change `PORT` in `.env`.

## Known limits

- No zip download. Drag files from Finder/Files instead.
- No undo for a bad render — it overwrites the file at that slide number. The saved `slides.json` keeps your text prompts intact.
- Refs persist per-slug on disk but are also duplicated in localStorage (so the UI survives refresh). Clear state with **reset** in the top bar.
- Grok's multi-image edit payload shape is inferred. See the troubleshooting note above.
