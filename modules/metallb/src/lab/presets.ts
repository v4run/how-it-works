// One-click scenarios. Each replaces the whole cluster config so you can jump
// straight to a teaching situation, then poke at it. IPs are left null — the
// reducer's controller reconcile assigns them from the pool on load.
import { LabState, ServiceT, freshNodes } from './model';

const svc = (id: string, name: string, seq: number): ServiceT => ({ id, name, seq, ip: null });

export interface Preset {
  label: string;
  hint: string;
  state: Partial<LabState>;
}

export const PRESETS: Preset[] = [
  {
    label: 'L2 basics',
    hint: 'one leader answers ARP',
    state: {
      mode: 'l2',
      policy: 'Cluster',
      bfd: true,
      poolStart: 240,
      poolSize: 6,
      nodes: freshNodes(),
      services: [svc('s1', 'web', 1), svc('s2', 'api', 2)],
      selected: 's1',
      nextSeq: 3,
    },
  },
  {
    label: 'BGP + ECMP',
    hint: 'every node advertises /32',
    state: {
      mode: 'bgp',
      policy: 'Cluster',
      bfd: true,
      poolStart: 240,
      poolSize: 8,
      nodes: freshNodes(),
      services: [svc('s1', 'web', 1), svc('s2', 'api', 2), svc('s3', 'cache', 3)],
      selected: 's1',
      nextSeq: 4,
    },
  },
  {
    label: 'Pool exhaustion',
    hint: 'more Services than IPs',
    state: {
      mode: 'l2',
      policy: 'Cluster',
      bfd: true,
      poolStart: 240,
      poolSize: 2,
      nodes: freshNodes(),
      services: [svc('s1', 'web', 1), svc('s2', 'api', 2), svc('s3', 'cache', 3), svc('s4', 'db', 4)],
      selected: 's3',
      nextSeq: 5,
    },
  },
  {
    label: 'Local + source IP',
    hint: 'preserve the client IP',
    state: {
      mode: 'bgp',
      policy: 'Local',
      bfd: true,
      poolStart: 240,
      poolSize: 6,
      nodes: freshNodes(),
      services: [svc('s1', 'web', 1), svc('s2', 'api', 2)],
      selected: 's1',
      nextSeq: 3,
    },
  },
];
