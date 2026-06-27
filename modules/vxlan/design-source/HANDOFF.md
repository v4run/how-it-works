# VXLAN — design source

Imported from the Claude Design project
`3a8a28cb-6aa7-48f1-818b-cc9f49e1b3f6` ("VXLAN Explained.dc.html").

- `VXLAN Explained.dc.html` — the DC entry point. Mounts `VXLANVideo` from
  `animations.jsx` (the timeline engine) + `vxlan-video.jsx` (the scenes).
- `vxlan-video.jsx` — the explainer film: 13 scenes (cold open → the problem →
  overlay/underlay → VTEP → encapsulation → VNI → spine-leaf fabric →
  flood-and-learn → BGP EVPN → EVPN route types → ARP suppression → packet
  walk → recap).

The film is ported faithfully to TypeScript in `../src/film/Film.tsx`, running
on the project's shared engine (`../src/engine/timeline.tsx` ≙ the prototype's
`animations.jsx`). The interactive **Lab** (`../src/lab/`) is new — it teaches
the same concepts hands-on (build a fabric, assign VNIs, send traffic, watch
VTEP encap/decap, EVPN learning, ARP suppression and VNI isolation live).
