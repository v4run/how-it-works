// Assembles the GitHub Pages site from every module listed in modules.json.
//
//   1. For each module: install deps and run its `build` script.
//   2. Copy each module's dist into  site/<slug>/.
//   3. Generate a landing page (site/index.html) linking to every module.
//   4. Drop a .nojekyll so Pages serves Vite's hashed asset files verbatim.
//
// Add a module by creating a folder with its own build that emits `dist/`,
// then adding an entry to modules.json. No changes to this script needed.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'modules.json'), 'utf8'));
const siteDir = join(root, 'site');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });

rmSync(siteDir, { recursive: true, force: true });
mkdirSync(siteDir, { recursive: true });

for (const m of manifest.modules) {
  const dir = join(root, m.dir);
  if (!existsSync(dir)) throw new Error(`Module dir not found: ${m.dir}`);
  console.log(`\n▸ Building module "${m.slug}" (${m.dir})`);
  const install = existsSync(join(dir, 'package-lock.json')) ? 'npm ci' : 'npm install';
  run(install, dir);
  run('npm run build', dir);
  const dist = join(dir, 'dist');
  if (!existsSync(dist)) throw new Error(`Module "${m.slug}" did not emit dist/`);
  cpSync(dist, join(siteDir, m.slug), { recursive: true });
  console.log(`  ✓ ${m.slug} → site/${m.slug}/`);
}

writeFileSync(join(siteDir, '.nojekyll'), '');
writeFileSync(join(siteDir, 'index.html'), landingPage(manifest));
console.log(`\n✓ Site assembled at site/ (${manifest.modules.length} module(s))`);

/* ── Landing page ───────────────────────────────────────────────────────── */
function esc(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function landingPage({ site, modules }) {
  const accent = site.accent || '#85c20a';
  const cards = modules
    .map((m) => {
      const a = m.accent || accent;
      const tags = (m.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      return `
      <a class="card" href="./${esc(m.slug)}/" style="--accent:${esc(a)}">
        <div class="bar"></div>
        <div class="card-body">
          <h2>${esc(m.title)}</h2>
          <p>${esc(m.description)}</p>
          <div class="tags">${tags}</div>
          <div class="open">Open module →</div>
        </div>
      </a>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(site.title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23070b0c'/%3E%3Crect x='6' y='7' width='4' height='18' rx='1.5' fill='%2385c20a'/%3E%3Crect x='12' y='7' width='4' height='18' rx='1.5' fill='%2385c20a'/%3E%3Crect x='18' y='7' width='8' height='18' rx='1.5' fill='%2321d3c9'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root { --accent: ${esc(accent)}; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; background: #070b0c; color: #eaf1e6;
    font-family: 'Space Grotesk', system-ui, sans-serif;
    background-image:
      radial-gradient(ellipse 60% 40% at 50% 0%, rgba(133,194,10,0.08), transparent 70%),
      linear-gradient(rgba(150,180,140,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(150,180,140,0.06) 1px, transparent 1px);
    background-size: auto, 60px 60px, 60px 60px;
  }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 88px 28px 80px; }
  header { margin-bottom: 56px; }
  .kicker { font-family: 'IBM Plex Mono', monospace; font-size: 13px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--accent); display: flex; align-items: center; gap: 12px; }
  .kicker::before { content: ''; width: 28px; height: 1px; background: var(--accent); opacity: 0.7; }
  h1 { font-size: 52px; font-weight: 700; letter-spacing: -0.02em; margin: 20px 0 12px; line-height: 1.05; }
  .tagline { font-family: 'IBM Plex Mono', monospace; font-size: 17px; color: rgba(214,226,210,0.62); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
  .card {
    display: flex; flex-direction: column; text-decoration: none; color: inherit;
    border: 1px solid rgba(150,180,140,0.16); border-radius: 16px; overflow: hidden;
    background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.18));
    transition: transform 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease;
  }
  .card:hover { transform: translateY(-3px); border-color: var(--accent); box-shadow: 0 18px 50px rgba(0,0,0,0.45), 0 0 0 1px var(--accent); }
  .bar { height: 4px; background: var(--accent); box-shadow: 0 0 18px var(--accent); }
  .card-body { padding: 22px 22px 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
  .card h2 { font-size: 23px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
  .card p { font-family: 'IBM Plex Mono', monospace; font-size: 14px; line-height: 1.6; color: rgba(214,226,210,0.62); margin: 0; flex: 1; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.04em; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(150,180,140,0.24); color: rgba(214,226,210,0.7); }
  .open { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--accent); margin-top: 4px; }
  footer { margin-top: 64px; font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: rgba(214,226,210,0.34); }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="kicker">Interactive learning</div>
      <h1>${esc(site.title)}</h1>
      <div class="tagline">${esc(site.tagline || '')}</div>
    </header>
    <main class="grid">
${cards}
    </main>
    <footer>${modules.length} module${modules.length === 1 ? '' : 's'} · built as static sites · open any to start.</footer>
  </div>
</body>
</html>
`;
}
