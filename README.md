# carousel-forge

Local web tool for parallel carousel slide generation via xAI Grok or OpenAI gpt-image-1.

Create a **project** (a brand), drop in your reference images and master prompt once, then spin up as many **carousels** as you want under that project. Each carousel is a set of slide texts; the tool fans them out in parallel and saves the outputs as `01.png`, `02.png`, … ready to drag into Instagram or TikTok.

Ship presets in the repo, install them into local projects with one click.

## Setup (one time)

```sh
cd carousel-forge
npm install
cp .env.example .env
# Edit .env — set PROVIDER and paste your key(s)
npm start
```

Node 20+ required. Open [http://localhost:4321](http://localhost:4321).

### Which provider?

| | `PROVIDER=xai` (Grok) | `PROVIDER=openai` (gpt-image-1) |
|---|---|---|
| Multi-ref | up to 5 | up to 16 |
| Native portrait | 3:4 (tool center-crops to 4:5) | 1024×1536 / 2:3 (tool center-crops to 4:5) |
| Primary endpoint | `/v1/images/edits` | `/v1/images/edits` |
| Notes | Grok's multi-image payload shape is inferred from docs. If Grok rejects the array, switch `PROVIDER=openai` in `.env` and restart. | Strongest instruction-following. Slower. |

Default is `xai`.

## Concepts

- **Preset** — a read-only template shipped with the repo. Lives under `presets/<preset-slug>/`. Contains a `brand.json` (name, description, master prompt) and one or more carousel templates.
- **Project** — a user-created folder on your machine, one per brand. Lives under `projects/<project-slug>/`. Contains `project.json` (name, description, master prompt), a shared `refs/` library, and one or more carousels.
- **Carousel** — a set of slide texts plus optional palette note and master-prompt override. Renders land in `carousels/<carousel-slug>/slides/01.png…N.png`.

Projects are gitignored. Presets are the thing the repo ships.

## Flow

1. **Start at the project list.** Install a preset (copies its carousels into a new project) or create a blank project.
2. **In the project view,** drop up to 5 reference images into the library and edit the master prompt. Both apply to every carousel.
3. **Create or open a carousel.** Edit slide texts. Optionally override the master prompt or add a palette note for this carousel only.
4. **Preview slide 1.** If it looks right, click **generate 2-N** to fan out the rest. If not, tweak the prompt and preview again — you haven't burned N renders on a bad prompt.
5. **Download the zip.** The export card hands you `<carousel-slug>.zip` containing the slides numbered `01.png, 02.png, …`. Or grab them directly from `projects/<project-slug>/carousels/<carousel-slug>/slides/`.

## Files on disk

```
presets/
  <preset-slug>/
    brand.json                 — name, description, masterPrompt
    carousels/
      <carousel-slug>/
        metadata.json          — title, description, palette, masterPromptOverride
        slides.json            — [ "slide 1 text", "slide 2 text", ... ]

projects/                      — gitignored
  <project-slug>/
    project.json               — name, description, masterPrompt, installedFrom?
    refs/                      — ref-01.png, ref-02.png, ... (shared across carousels)
    carousels/
      <carousel-slug>/
        metadata.json          — title, description, palette, masterPromptOverride
        slides.json
        slides/                — rendered outputs: 01.png, 02.png, ...
```

All outputs center-cropped to 4:5 (Instagram portrait max).

## Adding your own preset

1. Make a folder under `presets/<your-slug>/` with a `brand.json` and any number of `carousels/<carousel-slug>/` subfolders, each with a `metadata.json` and `slides.json`.
2. Restart the server. Your preset shows up in the project-list view under "install from preset."

## Regenerating one slide

Each slide row has its own **generate** button. Click it anytime — the output at that slide number gets overwritten.

## Troubleshooting

- **"xAI 400: invalid image field"** — Grok may not accept the inferred array shape. Switch `PROVIDER=openai` in `.env` and restart.
- **Outputs look too close to one reference** — try reducing refs to the 2-3 most representative ones.
- **Cropped output looks tight** — 4:5 crop is center-based. For top- or bottom-weighted content, bump `GROK_ASPECT_RATIO=9:16` in `.env` for a taller render with more crop slack.
- **Port 4321 in use** — change `PORT` in `.env`.

## Known limits

- No undo for a bad render — it overwrites the file at that slide number. Your slide texts are preserved in `slides.json`.
- Grok's multi-image edit payload shape is inferred. See troubleshooting.
