// Concise, technically-accurate definitions for the jargon the lab surfaces.
// Used as hover tooltips (native title=) and by the <Term> helper so a
// mid-level engineer never hits a term they can't immediately look up.

export const G: Record<string, string> = {
  ARP: 'Address Resolution Protocol — maps an IPv4 address to a MAC address on a local segment. A host broadcasts "who has <IP>?"; the owner replies "<IP> is-at <MAC>". MetalLB L2 mode answers these for the service IP.',
  'gratuitous ARP':
    'An unsolicited ARP reply a node broadcasts to proactively update everyone’s ARP/MAC caches. On L2 failover the new owner sends one so switches and clients relearn where the IP lives.',
  NDP: 'Neighbor Discovery Protocol — the IPv6 equivalent of ARP. MetalLB L2 mode uses NDP (not ARP) for IPv6 service IPs.',
  BGP: 'Border Gateway Protocol — a routing protocol. In BGP mode each speaker opens a BGP session with your router and advertises the service IP as a route.',
  ASN: 'Autonomous System Number — identifies a BGP speaker. The cluster and the router each have one (here AS 64500 and AS 64512).',
  BGPPeer: 'MetalLB CRD describing a router to peer with — its address and ASN, plus options like BFD and passwords.',
  ECMP: 'Equal-Cost Multi-Path — the router installs several equally-good next-hops for one prefix and hashes each flow to one of them, spreading connections across nodes. This is what makes BGP mode true load balancing.',
  '5-tuple': 'src IP, src port, dst IP, dst port, protocol — the fields a router hashes to pick an ECMP next-hop, so all packets of one connection take the same path.',
  DaemonSet: 'A Kubernetes workload that runs exactly one pod on every matching node. MetalLB’s speaker is a DaemonSet — hence one speaker per node.',
  Deployment: 'A Kubernetes workload that keeps N replicas of a pod running and reschedules them on failure. MetalLB’s controller is a single-replica Deployment.',
  'kube-proxy':
    'The per-node component that implements Service load balancing. It DNATs the service IP to a backend pod (via iptables or IPVS) and, under Cluster policy, SNATs the source so replies return correctly.',
  memberlist:
    'A gossip-based cluster-membership and failure-detection library. MetalLB L2 speakers use it to agree on which nodes are alive; default failure detection takes several seconds (~10s).',
  IPAddressPool: 'MetalLB CRD listing the addresses (ranges or CIDRs) the controller may hand out to LoadBalancer Services.',
  L2Advertisement: 'MetalLB CRD that selects which IPAddressPools are announced via Layer 2 (ARP/NDP), and optionally from which nodes/interfaces.',
  BGPAdvertisement: 'MetalLB CRD that selects which IPAddressPools are announced via BGP, and how (communities, aggregation length, local-pref).',
  speaker: 'MetalLB DaemonSet pod (one per node) that ANNOUNCES assigned IPs to the network — answering ARP/NDP in L2 mode, or advertising BGP routes in BGP mode.',
  controller:
    'MetalLB Deployment (1 replica) that ALLOCATES an IP from a pool to each LoadBalancer Service and writes it to the Service’s status. Pure bookkeeping — it talks to no router.',
  LoadBalancer:
    'A Service type that asks the platform for an external IP plus a way to attract that IP’s traffic. In the cloud the cloud-controller fulfils it; on bare metal nothing does — which is the gap MetalLB fills.',
  pending: 'A LoadBalancer Service that has no external IP yet. On bare metal without MetalLB it stays <pending> indefinitely.',
  CIDR: 'Classless Inter-Domain Routing notation, e.g. 192.168.1.240/28 — a compact way to write a block of IPs. IPAddressPools accept either ranges or CIDRs.',
  externalTrafficPolicy:
    'Service field controlling how a node handles inbound external traffic. Cluster: forward to any pod cluster-wide (even spread, but an extra hop and the client IP is SNAT’d away). Local: only nodes running a pod are used (no hop, client IP preserved, but risk of imbalance).',
  SNAT: 'Source NAT — rewriting a packet’s source IP. Under Cluster policy kube-proxy SNATs the source to the node’s IP so the reply comes back through the same node; the backend pod therefore sees the node IP, not the real client.',
  'source IP': 'The client’s real address. Local policy preserves it end-to-end; Cluster policy replaces it with the ingress node’s IP via SNAT.',
  BFD: 'Bidirectional Forwarding Detection — a lightweight liveness protocol that spots a dead BGP peer in well under a second, versus the ~90s default BGP hold timer.',
  leader:
    'In L2 mode, the single node currently answering for a given service IP. Not a vote — every speaker deterministically derives the same owner from the live member set, so a death re-derives a new one.',
  '/32': 'A single-host route (one IPv4 address). In BGP mode each node advertises the service IP as a /32 with itself as next-hop.',
  'ToR router': 'Top-of-Rack router/switch — the first-hop router the rack’s servers connect up to. In BGP mode MetalLB peers with it and it does the ECMP load-spreading.',
  'hold timer': 'The BGP timer after which a silent peer is declared dead (default ~90s). BFD replaces this slow detection with sub-second detection.',
};
