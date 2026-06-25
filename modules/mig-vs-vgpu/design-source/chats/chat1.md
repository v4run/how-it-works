# Nvidia MIG and vGPU internals

_Started 2026-06-25 17:49 UTC_

---

## User

nvidia mig and vGPU internals

## Assistant

I'd love to build this as an animated explainer. Before I start, a few questions so I make the right thing rather than guessing.

_[tool: questions_v2]_

## User

Questions answered:
- focus: Both — compare/contrast MIG vs vGPU
- audience: Infra/platform engineers
- depth: Deep — engine partitioning, fault isolation, GPCs/SMs/L2 slices, time-slicing scheduler
- length: 2+ minutes (thorough)
- aspect: 16:9 (landscape / presentation)
- keypoints: SR-IOV, MIG slice profiles (1g.5gb etc.), QoS, fault isolation, MPS comparison
- vibe: Dark mode datacenter (sleek, NVIDIA-adjacent greens on black)
- color: NVIDIA green on dark
- narration: Write it as if a VO will be added (captions + notes)
- motion: Smooth diagrammatic (things slice, split, slot into place)

## Assistant

Great — clear direction. Let me get the animation engine in place and study it before building.

_[tool: copy_starter_component]_

_[tool: read_file]_

This is a meaty build. Let me lay out the plan, then build the film as one self-contained animation module mounted by a thin DC.

_[tool: update_todos]_

Now the main build. Writing the self-contained film module (engine + shared visual system + all scenes):

_[tool: write_file]_

Now the thin DC entrypoint:

_[tool: dc_write]_

_[tool: show_html]_

_[tool: get_webview_logs]_

I'll spot-check key scenes visually since this is a heavy build.

_[tool: multi_screenshot]_

Seeking via keyboard didn't advance. Let me seek through localStorage + reload, and check brighter scenes.

_[tool: eval_js]_

_[tool: show_html]_

Visuals look strong. The running page keeps overwriting localStorage, so seeking is fighting it. Let me expose a seek hook for reliable scene capture.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Strong overall. A few collisions to fix: die header labels clash with MIG group labels (S4, S5), the compare-scene title overlaps its kicker (S9), and the closing subtitle overlaps the headline (S11). Let me fix these.

_[tool: read_file]_

Now let me apply the fixes. First the Die — add `hideHeader`, fix group label/fault collisions:

_[tool: str_replace_edit]_

Now use `hideHeader` in S4, S5, S0, and remove the in-die fault banner in S5/S8 (now handled by group label):

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now fix S11 closing spacing:

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Two small overlaps remain — S5 fault label is too long, and the closing headline still wraps into the subtitle. Fixing both:

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: multi_screenshot]_

Closing is clean now. The S5 fault suffix still grazes the GI-2 label — I'll drop the suffix since the red border + "halted" bar already signal it.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

All scenes built and collisions resolved. Let me mark the work done and run final verification.

_[tool: update_todos]_

_[tool: ready_for_verification]_

Done — a ~3:08 dark-datacenter explainer, **MIG vs vGPU Internals.dc.html**. Press space to play, scrub or arrow-key (Shift = ±5s) to seek.

**The arc (12 scenes):** title → GPU anatomy (GPCs/SMs, L2, memory controllers) → "spatial vs temporal" split → MIG: physical slicing, the 1g.5gb→7g.40gb profile catalog, hardware fault isolation + guaranteed QoS → vGPU: SR-IOV virtual functions, the time-slice scheduler wheel, the memory-isolated/compute-shared trade-off → side-by-side matrix → MIG-backed vGPU + an MPS footnote → close. Everything's built on one shared GPU-die visual that slices, lights up, and gets handed between VMs.

The on-screen captions are written as VO lines. Here's the voiceover script keyed to the captions if you want to record over it:

- **0:00** One GPU. Many tenants. Two very different ways to share it — MIG and vGPU. Let's look inside the silicon.
- **0:09** Before you divide a GPU, know what's inside: GPCs full of SMs for compute, a shared L2 cache and crossbar, and memory controllers feeding HBM. MIG and vGPU each divide these three — very differently.
- **0:31** Same chip, two philosophies. MIG partitions it in space; vGPU partitions it in time.
- **0:41** MIG slices the physical die — on an A100, seven compute slices and eight memory slices. SMs, L2 and memory controllers are hard-assigned to each GPU Instance. Real, electrically-isolated boundaries.
- **1:03** Profiles name the slice — 1g.5gb up to 7g.40gb. Mix them to fit the workload; each is a complete GPU to CUDA, and Compute Instances can subdivide further.
- **1:22** Because partitions are physical, a fault in one instance can't touch another. Bandwidth and L2 are reserved — deterministic, no noisy neighbors.
- **1:36** vGPU takes a different path. On Ampere and later, SR-IOV exposes the GPU as Virtual Functions — one per VM, each with isolated PCIe and DMA. Framebuffer is statically carved per profile.
- **1:52** But compute isn't carved in space — it's shared in time. The scheduler hands the entire SM array to one VM per quantum, then rotates. Best-effort, equal-share or fixed-share.
- **2:14** So memory is isolated, compute is shared — a hung context can stall the queue. No hardware fault containment like MIG.
- **2:24** Side by side: spatial guarantees versus temporal flexibility.
- **2:46** And they compose — a vGPU on a MIG instance gives you both. (MPS is a third, cooperative option: faster switching, but no protection or QoS.)
- **3:00** Carve the silicon, or share the clock.

Want me to tune any scene's pacing, adjust the technical depth, or export this to a video/PPTX?

