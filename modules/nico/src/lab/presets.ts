// Ready-made scenarios. Each builds a full LabState by replaying reducer actions
// from a blank slate. Generated ids are unpredictable, so we reference servers
// and tenants by index off the intermediate state.
import { C } from '../design/theme';
import { Action, LabState, reducer } from './model';

function blank(): LabState {
  return { servers: [], tenants: [], dpuEnforcement: true, running: false, seq: 0, nextNode: 1, nextTenant: 0, resetNonce: 0 };
}
const apply = (s: LabState, a: Action) => reducer(s, a);

function addServers(s: LabState, n: number): LabState {
  for (let i = 0; i < n; i++) s = apply(s, { type: 'addServer' });
  return s;
}
function addTenants(s: LabState, n: number): LabState {
  for (let i = 0; i < n; i++) s = apply(s, { type: 'addTenant' });
  return s;
}

export interface Preset {
  name: string;
  hint: string;
  accent: string;
  build: () => LabState;
}

export const PRESETS: Preset[] = [
  {
    name: 'Fresh rack',
    hint: 'Six raw servers. Hit play and watch NICo discover + provision the whole rack hands-free.',
    accent: C.green,
    build: () => {
      let s = addServers(blank(), 6);
      return apply(s, { type: 'toggleRunning' });
    },
  },
  {
    name: 'Multi-tenant cloud',
    hint: 'Three tenants on a shared fabric — each gets isolated network slices; cross-tenant traffic is denied at the DPU.',
    accent: C.green,
    build: () => {
      let s = addTenants(blank(), 3);
      s = addServers(s, 6);
      const t = s.tenants;
      [t[0], t[0], t[1], t[1], t[2], t[2]].forEach((tn, i) => {
        s = apply(s, { type: 'assignTenant', id: s.servers[i].id, tenantId: tn.id });
      });
      return apply(s, { type: 'toggleRunning' });
    },
  },
  {
    name: 'Fault & self-heal',
    hint: 'A node hits a hardware fault during imaging — NICo reconciles (retries) and brings it to Ready on its own.',
    accent: C.red,
    build: () => {
      let s = addTenants(blank(), 1);
      s = addServers(s, 3);
      s.servers.forEach((srv) => {
        s = apply(s, { type: 'assignTenant', id: srv.id, tenantId: s.tenants[0].id });
      });
      s = apply(s, { type: 'toggleFault', id: s.servers[1].id });
      return apply(s, { type: 'toggleRunning' });
    },
  },
  {
    name: 'Compromised host',
    hint: 'DPU enforcement disabled — see cross-tenant traffic leak between tenants. This is exactly what the DPU prevents.',
    accent: C.red,
    build: () => {
      let s = addTenants(blank(), 2);
      s = addServers(s, 4);
      const t = s.tenants;
      [t[0], t[0], t[1], t[1]].forEach((tn, i) => {
        s = apply(s, { type: 'assignTenant', id: s.servers[i].id, tenantId: tn.id });
      });
      s = apply(s, { type: 'setDpuEnforcement', on: false });
      return apply(s, { type: 'toggleRunning' });
    },
  },
];
