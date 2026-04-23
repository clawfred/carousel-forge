# Contributing

Thanks for taking the time to look. This is a small tool — contributions that keep it small are the most welcome.

## Dev setup

```sh
git clone https://github.com/clawfred/carousel-forge.git
cd carousel-forge
npm install
cp .env.example .env   # set PROVIDER and paste your key(s)
npm run dev
```

`npm install` wires up a pre-commit hook (via husky + lint-staged) that runs `eslint --fix` on staged TS/TSX.

## Before pushing

```sh
npm run typecheck
npm run lint
```

CI runs both on every PR. Keep them green.

## Code style

- TypeScript strict mode, no `any`.
- Prefer many small files over one big one. No god files, no kitchen-sink hooks.
- Keep the public API of each module narrow — a hook returning 10+ values is a sign to split.
- Write comments only when the *why* is non-obvious. Don't narrate the code.

## Project layout

```
app/            Next.js routes (pages + API)
components/     React components (UI + stages)
lib/            Shared helpers, types, and Zustand stores
  stores/       Client-side state, split by domain (project / brand / carousel / generation)
presets/        Read-only brand presets shipped with the repo
projects/       Gitignored — your local data lives here
```

## Adding a preset

Drop a folder under `presets/<your-slug>/` with a `brand.json` and a `carousels/` subtree. Restart the dev server and it shows up in the project-list view. See the existing preset for the expected shape.

## Reporting issues

[Open an issue](https://github.com/clawfred/carousel-forge/issues). Include:
- What you tried
- What happened (error text, screenshot)
- `PROVIDER=` value and node version

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
