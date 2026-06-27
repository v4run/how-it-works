# NICo module — design

NICo = **NVIDIA Infra Controller**: zero-touch lifecycle automation for bare metal
(discover → image → configure → secure), DPU-enforced isolation, multitenant
networking, API-driven control plane.

New module `modules/nico/`, structurally a clone of `modules/mig-vs-vgpu`
(Vite + React + TS, `base: './'`). Added to `modules.json` so the landing page +
CI pick it up with no build-script changes. Two tabs (like MIG): **Lab**
(interactive) and **Learn** (explainer film).

## Reused / copied infrastructure

- `engine/anim.ts`, `engine/timeline.tsx` — copied verbatim (generic Stage /
  Sprite / SceneFrame, Easing/clamp/interpolate).
- `design/theme.ts` — NICo palette from `nico-film.jsx`: green `#76B900`,
  greenHi `#9fe025`, tenant hues (`#76B900`, teal `#34d1c4`, purple `#c98bff`),
  amber `#f2a93b`, red `#e2533d`. Fonts: Space Grotesk / IBM Plex Sans / Mono.
- `design/atoms.tsx` — Caption/Chip/Kicker/Button/GridBackdrop/FitBox, restyled
  to NICo green.
- `App.tsx` — TopBar "NVIDIA Infra Controller · NICo", Lab/Learn tabs.

## Film (`film/Film.tsx`)

Faithful port of design `nico-film.jsx` into the project's own TS engine (same
approach MIG's film took — does not use the design `animations.jsx` Stage).
~106s, 7 scenes via `Stage`/`SceneFrame`, scenes take `lt`:

1. Title — "NVIDIA Infra Controller / NICo" over a rack row.
2. The problem — bare metal is slow/manual (Discover/Image/Network/Secure).
3. Zero-touch provisioning — node walks the lifecycle FSM.
4. DPU-enforced isolation — packets net→BlueField DPU→host, some denied.
5. Multitenant networking — three tenants share one fabric, never cross.
6. API-driven control plane — 3-layer NICo stack + `POST /v1/nodes`.
7. Closing — recap tags.

Port the design's `Rack`/`Backdrop`/`Caption`/`env`/`appear`/`lerp` helpers;
continuous motion (LED blink, packets) uses engine `useTime()`.

## Lab (`lab/`)

Same architecture as the MIG lab: reducer holds staged config, RAF
`useSimulation` computes runtime state while `running`, `LabViz` renders,
`LabControls` is the control plane. Build-then-run.

### Domain model (`model.ts`)

- **Server**: `{ id, name (node-NN), hw, desired: 'discovered' | 'provisioned',
  tenantId | null, faultInjected }`. Users **add servers** (start raw /
  undiscovered); the sim discovers + provisions them. Cap ~12.
- **Tenant**: `{ id, name, color, vlan, pkey }`. Add/remove freely. Cap ~5
  (palette size).
- **Policy**: `{ dpuEnforcement: boolean }` — key teaching toggle.
- Lifecycle FSM (runtime): `Detected → Discover (PXE/DHCP) → Inventory → Image →
  Configure → Ready`. `desired:'discovered'` stops at Inventory;
  `'provisioned'` runs to Ready.

### Simulation (`useSimulation`) — while running

- Each server advances its FSM along staggered time-gates →
  `{ stageIdx, progress, status, led, reconciles }`.
- **Faulted** server stalls mid-stage, then NICo **reconciles** (auto-retries
  every few sec, increments counter, recovers) — self-healing beat.
- Ready + tenant-assigned servers emit **per-tenant packet flows**
  net→DPU→host. **Cross-tenant probes** denied at the DPU (red); with
  `dpuEnforcement` off they leak — the isolation contrast.
- Snapshot: per-server lifecycle view + per-tenant stats (throughput, allowed,
  blocked).

### Viz (`LabViz`)

- **Fleet grid** of server cards: LED, current stage, progress bar, tenant chip,
  DPU badge (raw servers dim).
- **DPU/network lane**: animated per-tenant colored packets net→DPU→host; red
  blocked packets bouncing at the DPU boundary.

### Controls (`LabControls`)

- Servers: +add, desired toggle, assign tenant, inject fault, remove.
- Tenants: +add/remove, live per-tenant allowed/blocked/throughput.
- DPU enforcement toggle.
- Run / Pause / Reset + small reconcile/API log.
- Presets (`presets.ts`): "Fresh rack", "Multi-tenant cloud",
  "Fault & self-heal", "Compromised host".

## Out of scope (v1)

Real networking, persistence, more than the four headline capabilities. Iterate
after the first working build.
