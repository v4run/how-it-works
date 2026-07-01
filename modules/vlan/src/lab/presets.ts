// One-click scenarios covering the rubric's key situations.
import { LabState, defaultPortVlan } from './model';
import { VLAN_IDS } from '../design/theme';

export interface Preset {
  label: string;
  hint: string;
  state: Partial<LabState>;
}

const clean = (): Partial<LabState> => ({
  vlansEnabled: true,
  portVlan: defaultPortVlan(),
  trunkMode: 'trunk',
  allowed: [...VLAN_IDS],
  linkAccessVlan: 1,
  nativeA: 1,
  nativeB: 1,
  routing: 'l3',
  routableVlans: [...VLAN_IDS],
});

export const PRESETS: Preset[] = [
  {
    label: 'Flat network',
    hint: 'no VLANs — one broadcast domain',
    state: { ...clean(), vlansEnabled: false, src: 'a1', dst: 'broadcast' },
  },
  {
    label: 'Segmented',
    hint: 'same-VLAN across the trunk',
    state: { ...clean(), src: 'a1', dst: 'b1' },
  },
  {
    label: 'Broadcast isolation',
    hint: 'ARP stays inside VLAN 10',
    state: { ...clean(), src: 'a1', dst: 'broadcast' },
  },
  {
    label: 'VLAN pruned off trunk',
    hint: 'VLAN 20 dropped at the trunk',
    state: { ...clean(), allowed: [10, 30], src: 'a2', dst: 'b2' },
  },
  {
    label: 'Native VLAN mismatch',
    hint: 'untagged frame leaks VLANs',
    state: { ...clean(), nativeA: 10, nativeB: 20, src: 'a1', dst: 'b1' },
  },
  {
    label: 'Link left as access',
    hint: 'trunk misconfigured as access',
    state: { ...clean(), trunkMode: 'access', linkAccessVlan: 10, src: 'a2', dst: 'b2' },
  },
  {
    label: 'Router-on-a-stick',
    hint: 'VLAN 10 → 20 hairpins to router',
    state: { ...clean(), routing: 'router', src: 'a1', dst: 'a2' },
  },
  {
    label: 'No inter-VLAN routing',
    hint: 'different VLANs, blocked',
    state: { ...clean(), routing: 'none', src: 'a1', dst: 'b2' },
  },
  {
    label: 'Wrong access VLAN',
    hint: 'PC-B misassigned to Finance',
    state: { ...clean(), portVlan: { ...defaultPortVlan(), b1: 20 }, src: 'a1', dst: 'b1' },
  },
];
