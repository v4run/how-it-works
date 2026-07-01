# MetalLB — design source

Imported from the Claude Design project
`c3932d3f-c1e1-471e-8d79-0314fb89a119` ("MetalLB Explainer.dc.html").

- `MetalLB Explainer.dc.html` — the DC entry point. Mounts `MetalLBVideo` from
  `animations.jsx` (the timeline engine) + `metallb-scene.jsx` (the scenes).
- `metallb-scene.jsx` — the explainer film: 8 chapters (~3:28) —
  1. the problem (LoadBalancer Service stays `<pending>` on bare metal),
  2. architecture (controller allocates, speaker announces),
  3. address pools & advertisements (the two CRDs),
  4. Layer-2 mode (ARP/NDP, one leader node answers),
  5. Layer-2 failover (memberlist gossip, gratuitous ARP),
  6. BGP mode (every node advertises a /32, router ECMP),
  7. BGP convergence & caveats (BFD, rehash resets flows),
  8. Layer-2 vs BGP summary.

The film is ported faithfully to TypeScript in `../src/film/Film.tsx`, running
on the project's shared engine (`../src/engine/timeline.tsx` ≙ the prototype's
`animations.jsx`). The interactive **Lab** (`../src/lab/`) is new — it teaches
the same concepts hands-on (define IP pools, create LoadBalancer Services, watch
the controller allocate IPs and the speaker announce them via L2 or BGP, send
traffic, and kill nodes to see failover in each mode).
