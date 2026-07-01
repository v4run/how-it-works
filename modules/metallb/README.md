# MetalLB — interactive module

An interactive explainer for **MetalLB**: how a bare-metal Kubernetes cluster
gets a working `Service` of type **LoadBalancer** when there's no cloud
provider to hand out external IPs and attract their traffic.

MetalLB does exactly two jobs, split across two components:

- the **controller** (a Deployment) **allocates** an external IP to each Service
  from an `IPAddressPool` you define, and
- the **speaker** (a DaemonSet, one per node) **announces** that IP to the
  network — either in **Layer-2 mode** (one elected leader node answers
  ARP/NDP, so traffic funnels to it; failover only) or **BGP mode** (every
  eligible node advertises the IP as a `/32` and the router load-balances across
  them with **ECMP**).

Colour language throughout: **green = MetalLB / the data path**, **cyan = the
control plane** (controller + BGP peering), **amber = ARP / transient state**,
**red = failure**.

Two tabs:

- **Lab** — a live cluster you configure and break. Define the `IPAddressPool`
  (range + size), create **LoadBalancer Services** and watch the controller
  allocate each an external IP in order (over-subscribe the pool and the extras
  stay `<pending>`). Flip the speaker between **Layer 2** and **BGP** and see
  the topology re-draw: one **LEADER** answering ARP, or all nodes
  **ADVERTISING /32** with the router's ECMP route table. **Send traffic** to
  watch one request travel client → ARP/router → ingress node → kube-proxy →
  backend **pod**, and **kill a node** to compare failover — L2's ~10s memberlist
  detection + gratuitous ARP versus BGP's sub-second BFD detection, route
  withdrawal and ECMP recompute (with the flow-rehash caveat). Toggle
  `externalTrafficPolicy` to *see the source IP*: **Local** preserves the real
  client IP and stays on-node; **Cluster** shows the extra hop and the **SNAT**
  that rewrites the source to the node IP. Kill the **controller's node** and new
  Services correctly hang `<pending>` until it reschedules (existing IPs keep
  working); stop just a node's **speaker** to isolate the announcement path.
  Every jargon term carries a hover **tooltip**. A streaming **event log**
  narrates each controller/speaker action. Built-in scenarios: L2 basics,
  BGP + ECMP, pool exhaustion, Local + source IP.
- **Learn** — a diagrammatic explainer film (ported from the Claude Design
  prototype). Space to play/pause, ← → to seek. 8 chapters: the problem →
  controller/speaker architecture → pools & advertisements → Layer-2 mode →
  Layer-2 failover → BGP mode → BGP convergence & caveats → Layer-2 vs BGP.

> ⚠ Educational model built for intuition, not operational accuracy. Real
> MetalLB has more nuance (exact memberlist timing, BGP attributes/communities,
> FRR mode, IP-sharing/`allocateLoadBalancerNodePorts`, etc.) than this lab
> models.

## Local development

```bash
cd modules/metallb
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
  film/Film.tsx        the explainer film (8 chapters)
  lab/
    model.ts           domain model + reducer (pools, services, nodes);
                       pure derivations — IP allocation, L2 leader election,
                       BGP advertisers/ECMP, eligibility under Local policy
    useSimulation.ts   rAF clock for traffic dots + per-action event-log
                       narration and failover convergence banners
    LabViz.tsx         the cluster stage (topology, flow, route/ARP, log)
    LabControls.tsx    the control plane (mode, pool, services, nodes, tuning)
    presets.ts         one-click scenarios
    Lab.tsx            stage + control-plane shell
design-source/         the original Claude Design handoff for this module
```
