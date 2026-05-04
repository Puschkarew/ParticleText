# ParticleText

**GitHub About (copy-paste, plain text, under 350 characters):**

```text
Interactive WebGL particles from SVG paths (Three.js): mouse & scroll, radial waves, click explosions, glow and load easing. Minimal embed.html for iframes. Demo: https://puschkarew.github.io/ParticleText/
```

**Suggested repository topics:** `threejs`, `webgl`, `particles`, `svg`, `interactive`, `github-pages`, `javascript`, `visualization`

---

ParticleText is a static, no-build-step demo: thousands of points sample an SVG silhouette (default asset: `Break the Shape.svg`), then simulate in 3D with Three.js. Use **`index.html`** to tweak everything in real time, or **`embed.html`** for a clean embed without the control panel.

## Live demo

[https://puschkarew.github.io/ParticleText/](https://puschkarew.github.io/ParticleText/)

The site is published with GitHub Pages from the **`main`** branch (see [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)). Confirm in your repository **Settings → Pages** that the published source matches your expectations (GitHub Actions).

## Features

- **SVG-driven shape** — Particles are distributed from the loaded SVG; desktop and mobile presets point at the same file by default (`js/main.js` → `PRESETS`).
- **Interaction** — Cursor forces, optional scroll-based spread, autonomous motion, chaos and tangential force controls, spring/damping and global time scale.
- **Radial waves** — Optional expanding waves from the center with configurable interval, width, speed, force, glow intensity, and falloff; can be disabled in the panel.
- **Click explosion** — Impulse from the click point with return delay, scatter speed, and short-lived per-particle glow; can be disabled.
- **Look and feel** — Background and point colors, point size, max brightness, depth-based darkening, glow brightness and radius, velocity-linked glow, and point size variation.
- **Particle budget** — Main count, additional “outside” cloud count, and fraction of invisible outside points (within UI limits).
- **Load animation** — Duration and an editable cubic Bézier easing curve (curve editor and restart apply to **`index.html`** only).
- **Presets** — **Desktop** and **Mobile**; mobile uses a lower default particle count (7500 vs 10000) while sharing most other defaults. The active preset can follow window width (including iframe width).

## Entry points

| File | Purpose |
|------|--------|
| [`index.html`](index.html) | Full experience: control panel, load curve editor, performance tooling where wired. Uses `localStorage` for saved config. |
| [`embed.html`](embed.html) | Embedding: `data-particle-embed="true"` on `<html>` so `js/main.js` runs without the panel, without `localStorage` config, and without heavy monitors. |

Do not use `index.html` as a drop-in iframe if you want the minimal chrome; use `embed.html`. Details and checklists: [`docs/EMBED_FOR_AGENTS.md`](docs/EMBED_FOR_AGENTS.md).

## Run locally

You need a local HTTP server (ES modules and MIME types; avoid relying on `file://` for the main flow).

```bash
python3 -m http.server 8000
# open http://localhost:8000/index.html or http://localhost:8000/embed.html
```

Alternatively:

```bash
npx http-server
```

The repo includes [`server.py`](server.py) for a quick dev server (see [`docs/EMBED_FOR_AGENTS.md`](docs/EMBED_FOR_AGENTS.md) for usage and port notes).

## Embed on another site

Prefer an **iframe** pointing at your hosted `embed.html` (same-origin or controlled hosting for static assets). Deploy at least:

- `embed.html`
- `js/main.js`
- `css/style.css`
- The SVG referenced by your preset (default: `Break the Shape.svg` in the site root)

Optional: `index.html` if you want the full playground on the same host.

Full embedding rules, iframe example, and agent checklist: [`docs/EMBED_FOR_AGENTS.md`](docs/EMBED_FOR_AGENTS.md).

## Tech stack

- **Three.js** (loaded via ES module **import map** from jsDelivr, see `index.html` / `embed.html`)
- **Vanilla JavaScript** — single main module [`js/main.js`](js/main.js)
- **HTML5 / CSS** — [`css/style.css`](css/style.css)

No bundler or framework required.

## License

MIT — see [`LICENSE`](LICENSE).
