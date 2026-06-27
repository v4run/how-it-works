# NVIDIA Infra Controller (NICo) — interactive module

An interactive explainer for **NICo**, NVIDIA's zero-touch lifecycle automation
for bare metal: discover → image → configure → secure, DPU-enforced isolation,
multitenant networking, and an API-driven control plane.

It models the **real** NICo system (github.com/NVIDIA/infra-controller) — the
lifecycle, terminology and architecture are taken from NVIDIA's docs, so the lab
doubles as a way to understand the actual project.

Two tabs:

- **Lab** — a live datacenter engineering dashboard. Add bare-metal hosts and
  watch NICo run each through its real **Day 0 → Day 1** state machine:
  Detected (Redfish/OOB) → Discovery (Scout agent) → Validation (SKU + burn-in)
  → DPU Provisioning (BlueField BFB + HBN) → Attestation (Measured Boot/TPM) →
  OS Provisioning (PXE/iPXE) → Isolation (HBN VXLAN/EVPN VRF + UFM IB P_Key) →
  In Service. A **node inspector** shows each host's identity (BMC/MAC/serial/
  DHCP/DPU PCIe), discovered hardware, lifecycle progress, and isolation
  bindings (SR-IOV VF, VRF, P_Key). A live **reconcile log** streams every
  operation NICo performs; a **DPU isolation** panel shows the per-tenant
  `doca_flow` ACLs (allow intra-tenant / deny inter-tenant) with live hit
  counts. Inject a fault to watch NICo reconcile (requeue + retry); turn DPU
  enforcement off to see cross-tenant traffic leak. An **architecture
  reference** panel lays out the real control plane (Site Controller, NICo Core
  / REST, common services, host agents, isolation planes, Day 0/1/2). Built-in
  scenarios: fresh rack, multi-tenant cloud, fault self-heal, compromised host.
- **Learn** — a ~1:46 diagrammatic explainer film (ported from the Claude Design
  prototype). Space to play/pause, ← → to seek.

## References

- NICo overview & Day 0/1/2 lifecycle — https://docs.nvidia.com/infra-controller
- Source — https://github.com/NVIDIA/infra-controller (core, rest)

## Local development

```bash
cd modules/nico
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
  engine/              generic timeline engine (Stage / Sprite / SceneFrame) + easing
  design/              theme tokens + reusable atoms
  film/Film.tsx        the explainer film (7 scenes)
  lab/
    model.ts           domain model + reducer (servers, tenants, DPU policy)
    useSimulation.ts   RAF lifecycle + traffic simulation
    LabViz.tsx         fleet grid + per-tenant DPU traffic lanes
    LabControls.tsx    the control plane UI
    presets.ts         ready-made scenarios
```

The film here is a faithful TypeScript port of the Claude Design prototype
(`NICo Animation.dc.html` / `nico-film.jsx`) onto the shared engine.
