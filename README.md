# Interactive Systems Learning

A collection of self-contained, interactive explainers for how real infrastructure
works. Each **module** is its own small web app; they're built and stitched together
into a single static site (a landing page + one subpath per module) that deploys to
**GitHub Pages**.

## Live site

After enabling Pages (see below), the site is served at:

- Landing page → `https://<user>.github.io/<repo>/`
- Each module → `https://<user>.github.io/<repo>/<slug>/`

## Repository layout

```
modules.json              manifest: which modules exist + their titles/descriptions
modules/
  mig-vs-vgpu/            a module (Vite + React + TS) — builds to its own dist/
    design-source/        the original Claude Design handoff for this module
scripts/
  build-site.mjs          builds every module and assembles ./site (+ landing page)
.github/workflows/
  deploy.yml              CI: build all modules → deploy ./site to GitHub Pages
```

## Modules

| Module                               | What it teaches                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [`mig-vs-vgpu`](modules/mig-vs-vgpu) | NVIDIA GPU partitioning — MIG (spatial), vGPU (time-sliced) and MIG-backed vGPU. Interactive lab + explainer film. |

## Local development

Work on a single module:

```bash
cd modules/mig-vs-vgpu
npm install
npm run dev          # http://localhost:5173
```

Build the **whole site** (every module + landing page) into `./site`:

```bash
node scripts/build-site.mjs
npx serve site       # or any static server; open the printed URL
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (default branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main` (or run the _Deploy site to GitHub Pages_ workflow manually).
   The workflow builds all modules, assembles `./site`, and publishes it.

Modules use a relative asset base (`base: './'` in Vite), so they work at any
Pages subpath without hardcoding the repository name.

## Adding a new module

1. Create `modules/<your-module>/` — any project that builds static files into a
   `dist/` folder via `npm run build` (the Vite + React setup in `mig-vs-vgpu` is a
   good template). Set `base: './'` so it works under a subpath.
2. Add an entry to `modules.json`:

   ```json
   {
     "slug": "your-module",
     "dir": "modules/your-module",
     "title": "Your Module Title",
     "description": "One or two sentences for the landing-page card.",
     "tags": ["topic", "topic"],
     "accent": "#85c20a"
   }
   ```

3. Push. The landing page and deployment pick it up automatically — no changes to
   the build script or workflow required.
