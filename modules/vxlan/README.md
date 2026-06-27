# VXLAN — interactive module

An interactive explainer for **VXLAN** (Virtual Extensible LAN): how a virtual
Layer-2 segment is stretched across a routed Layer-3 fabric by wrapping each
Ethernet frame in UDP (**MAC-in-UDP**) at a tunnel endpoint.

Colour language throughout: **green = the overlay / VXLAN**, **steel-blue = the
physical underlay fabric**, **amber = flood / legacy / warning**.

Two tabs:

- **Lab** — a live fabric you build and probe. Declare virtual segments
  (**VNIs**) and drop hosts onto the leaf switches (the **VTEPs**) of a fixed
  spine-leaf underlay. Pick a source and destination and **send a frame**, then
  watch it animate across the topology: the ingress VTEP encapsulates it
  (VXLAN / UDP 4789 / IP `vtep→vtep`), the spine routes it as ordinary IP via
  ECMP, and the egress VTEP decapsulates and delivers the original frame. A
  **header-stack inspector** shows the exact layers built for the flow; a
  step ticker and a streaming **event log** narrate each operation. Toggle the
  control plane between **BGP EVPN** (learn-don't-flood, with a live route
  table) and **flood-and-learn** (BUM flooding + per-VTEP MAC tables that fill
  as flows complete); toggle **ARP suppression** and **jumbo MTU**. Built-in
  scenarios cover same-VNI forwarding, cross-VNI isolation, flood-and-learn,
  ARP suppression, MTU/fragmentation, and same-leaf local switching.
- **Learn** — a diagrammatic explainer film (ported from the Claude Design
  prototype). Space to play/pause, ← → to seek. 13 scenes: the problem →
  overlay/underlay → VTEP → packet anatomy → VNI → spine-leaf fabric →
  flood-and-learn → BGP EVPN → EVPN route types → ARP suppression → full
  packet walk → recap.

> ⚠ Educational model built for intuition, not operational accuracy. Real
> EVPN/VXLAN has more nuance (L3 VNIs / symmetric IRB, multihoming with EVPN
> Types 1 & 4, RT/RD policy, etc.) than this lab models.

## Local development

```bash
cd modules/vxlan
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
  design/              theme tokens + reusable atoms
  film/Film.tsx        the explainer film (13 scenes)
  lab/
    model.ts           domain model + reducer (segments, hosts, fabric, flags)
    net.ts             pure VXLAN logic: EVPN routes, MAC tables, flow planning
    useSimulation.ts   RAF flow animation + event-log streaming + MAC learning
    LabViz.tsx         fabric diagram, animated packet, tables, header inspector
    LabControls.tsx    the control plane UI
    presets.ts         ready-made scenarios
```

The film here is a faithful TypeScript port of the Claude Design prototype
(`design-source/VXLAN Explained.dc.html` / `vxlan-video.jsx`) onto the shared
engine. The lab is original to this module.
