# VLAN — design source

Imported from the Claude Design project
`34c3feac-213f-4622-9fed-ede5f8573fe5` ("VLAN Explainer.dc.html").

- `VLAN Explainer.dc.html` — the DC entry point. Mounts `VLANScene` from
  `animations.jsx` (the timeline engine) + `vlan-scene.jsx` (the scenes).
- `vlan-scene.jsx` — the explainer film ("VLANs, from the wire up"), 10 scenes
  (~5:00): intro → the flat network (one broadcast domain) → segmenting →
  access ports → 802.1Q tagging (field breakdown) → trunk links → native VLAN →
  inter-VLAN routing (router-on-a-stick) → VLAN hopping (switch-spoofing +
  double-tagging) → recap.

The film is ported faithfully to TypeScript in `../src/film/Film.tsx` on the
project's shared engine (`../src/engine/timeline.tsx` ≙ the prototype's
`animations.jsx`). The interactive **Lab** (`../src/lab/`) is new — a two-switch
fabric with a trunk and an L3 gateway where you assign access-port VLANs, tune
the trunk (allowed list + native VLAN), send broadcasts/unicasts and trace each
frame's tagged/untagged state hop by hop, route between VLANs, and inject the
classic misconfigurations.

VLAN colour code (shared with the film): VLAN 10 = green (Engineering),
VLAN 20 = amber (Finance), VLAN 30 = cyan (Guest).
