# MIG vs vGPU — Internals Lab

An interactive learning environment for NVIDIA datacenter GPU partitioning, built
from the Claude Design handoff in `design-source/`. It has a Lab with three
partitioning modes (MIG, vGPU, MIG-backed) plus the explainer film:

- **Lab** (interactive) — build MIG partitions, vGPUs, MIG-backed vGPUs and VMs,
  assign workloads, run them, and watch how each model *schedules compute*.
- **Learn** (explainer film) — the original ~3:08 diagrammatic explainer, ported
  faithfully scene-for-scene. Space = play/pause, ←/→ = seek (Shift = ±5s).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production bundle into dist/
npm run preview  # serve the production build
```

Stack: Vite + React + TypeScript. No CSS framework — the dark "datacenter" visual
system (NVIDIA green for MIG, teal for vGPU) is the design tokens ported verbatim
from the prototype.

## What you can do in the Lab

Model is an **H100 SXM5 80GB**: 7 GPC slices, 132 SMs, 8 × 10 GB memory slices
(HBM3) — values confirmed against `nvidia-smi mig -lgip`.

### MIG · spatial
- Add GPU Instances from real profiles (`1g.10gb` … `7g.80gb`). Placement is
  validated against NVIDIA's 19 valid MIG layouts (so e.g. a memory-heavy
  `3g.40gb` only packs when it sits on the right), alongside the 7-GPC-slice and
  80 GB framebuffer budgets — you can fragment yourself out of a slot. Each
  instance shows its real (non-uniform) SM count: `1g.10gb`=16, `3g.40gb`=60,
  `7g.80gb`=132.
- Assign a workload (idle / inference / render / training) per instance.
- **Bind a VM** onto an instance (SR-IOV VF) to create a **MIG-backed vGPU**.
- **Inject an XID fault** — it halts only that instance; neighbours keep running.
  This is the spatial-isolation lesson, shown live.

### vGPU · temporal
- Create VMs from C-series profiles (`H100-8C` … `H100-80C`); each carves a static
  framebuffer (memory isolation) and binds a Virtual Function.
- Pick a scheduler policy — and a time quantum. The whole SM array is handed to one
  VM at a time; the wheel shows the rotation (these are NVIDIA's three real vGPU
  schedulers — none uses per-VM weights):
  - **best-effort** — idle VMs are skipped; busy VMs soak up the spare cycles.
  - **equal-share** — split equally among the *running* VMs (1/N); add or remove a VM
    and every slice grows/shrinks.
  - **fixed-share** — each VM gets a fixed slice = *framebuffer / GPU memory* (1/max
    for its type; a 40C gets ½, a 20C ¼), regardless of how many run. Any leftover
    capacity sits idle (grey wedge) — consistent per-VM, but can waste the GPU.
- **Hang a context** — the hung VM never yields, stalling every tenant. Framebuffers
  stay isolated, but compute has no fault containment. This is the trade-off,
  shown live.

### MIG-backed · both
- A third mode combining the two. Each MIG slice backs **1–3 time-sliced vGPUs**
  (NVIDIA "MIG time-slicing" — check real hardware with `nvidia-smi -q` →
  "MIG Time-Slicing: Supported"). Add slices, then add vGPUs onto each slice.
- Across slices: workloads run **in parallel and hardware-isolated**. Within a
  slice with multiple vGPUs: they **time-slice that slice's compute** (each slice
  runs its own independent scheduler).
- Containment lesson: an XID **fault** halts its whole slice; a **hung vGPU**
  stalls only its *slice-mates* — never another slice. (Contrast: in pure vGPU
  mode a hang stalls everyone.) Framebuffer is split evenly across a slice's vGPUs.

Live per-unit metrics (compute utilization / GPU-time share, accumulated work)
update while the sim runs. **Scenarios** (top of the panel) load ready-made setups.

## Project layout

```
src/
  design/      theme tokens, the shared GPU-die visual, presentational atoms
  engine/      easing/interpolate + the timeline Stage used by the film
  film/        the 12-scene explainer
  lab/         model.ts (domain + reducer + allocator), useSimulation.ts
               (live scheduler), LabViz / SchedulerWheel / LabControls, presets
  App.tsx      Lab / Learn tab shell
```

The simulation is intentionally a teaching abstraction (e.g. the quantum is
exaggerated to ~1 s so the rotation is watchable, memory is mapped onto 8 visual
slices ≈ profile GB). The mechanics — spatial vs temporal, fault containment vs
scheduler stall, weighted shares — mirror the real hardware behaviour.
