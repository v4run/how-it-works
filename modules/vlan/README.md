# VLAN — interactive module

An interactive explainer for **VLANs** (Virtual LANs, IEEE **802.1Q**): how one
physical switch becomes many isolated Layer-2 networks, how a single trunk link
carries them all while preserving which VLAN each frame belongs to, and how you
route between them.

VLAN colour code (shared with the film): **VLAN 10 = green** (Engineering),
**VLAN 20 = amber** (Finance), **VLAN 30 = cyan** (Guest). Steel = the physical
infrastructure (switches, trunks); red = failure/misconfig.

Two tabs:

- **Lab** — a two-switch fabric (SW-A ↔ SW-B over a trunk) with an L3 gateway and
  six hosts on access ports. Toggle **VLANs on/off** to feel the flat "one
  broadcast domain" starting point; assign each **access port** a VLAN; tune the
  **trunk** — its **allowed-VLAN list** (pruning) and the **native VLAN** on each
  end (mismatch included); pick the **inter-VLAN routing** method (none /
  router-on-a-stick / L3-switch SVIs). Then **send a frame** (unicast or
  broadcast) and watch it animate hop by hop — untagged on access links,
  **802.1Q-tagged on the trunk** (or untagged if it's the native VLAN), stripped
  again at the far access port — with a live **frame inspector** breaking out the
  tag fields (TPID / PCP / DEI / VID) and a per-hop **trace** log. Every jargon
  term carries a hover **tooltip**. Built-in scenarios cover the flat network,
  broadcast isolation, a pruned VLAN, a native-VLAN mismatch, a trunk left as an
  access port, router-on-a-stick, missing routing, and a wrong access VLAN.
- **Learn** — a diagrammatic explainer film (ported from the Claude Design
  prototype). Space to play/pause, ← → to seek. 10 scenes: the flat network →
  segmenting → access ports → 802.1Q tagging (field breakdown) → trunk links →
  native VLAN → inter-VLAN routing → VLAN hopping (switch-spoofing +
  double-tagging) → recap.

> ⚠ Educational model built for intuition, not operational accuracy. Real
> switching has more nuance (STP, VTP/MVRP, per-VLAN MAC-learning timing, DTP
> negotiation states, QinQ, voice VLANs, dynamic 802.1X membership, etc.) than
> this lab models.

## Local development

```bash
cd modules/vlan
npm install
npm run dev          # http://localhost:5173
```

Build just this module:

```bash
npm run build        # emits dist/
```

Or build the whole site from the repo root (`node scripts/build-site.mjs`).

## Layout

```
src/
  App.tsx              Lab / Learn tab shell
  engine/              generic timeline engine (Stage / Sprite) + easing
  design/              theme tokens, reusable atoms, glossary (tooltips)
  film/Film.tsx        the explainer film (10 scenes)
  lab/
    model.ts           domain model + reducer + the frame-walk planner
    useSimulation.ts   rAF clock for the animation + per-hop trace narration
    LabViz.tsx         the fabric stage (topology, frame animation, inspector)
    LabControls.tsx    the switch config (ports, trunk, routing, scenarios)
    presets.ts         one-click scenarios
    Lab.tsx            stage + config-panel shell
design-source/         the original Claude Design handoff for this module
```
