// Hardware catalog, OS images and per-node identity facts. Static data that
// gives the lab real infra detail — what NICo discovers and images on each box.

export interface HwSpec {
  type: string;
  label: string;
  cpu: string;
  gpu: string;
  gpuCount: number;
  nic: string;
  dpu: string;
  dpuVfs: number; // SR-IOV VFs available on the BlueField for tenant workloads
  mem: string;
  disk: string;
  power: string;
}

export const HW_CATALOG: Record<string, HwSpec> = {
  'dgx-h100': {
    type: 'dgx-h100',
    label: 'NVIDIA DGX H100',
    cpu: '2× Xeon Platinum 8480C · 112C/224T',
    gpu: '8× H100 80GB SXM5',
    gpuCount: 8,
    nic: '8× ConnectX-7 400Gb IB',
    dpu: '2× BlueField-3',
    dpuVfs: 16,
    mem: '2 TB DDR5',
    disk: '8× 3.84 TB U.2 NVMe',
    power: '10.2 kW',
  },
  'hgx-h200': {
    type: 'hgx-h200',
    label: 'NVIDIA HGX H200',
    cpu: '2× EPYC 9654 · 192C/384T',
    gpu: '8× H200 141GB SXM5',
    gpuCount: 8,
    nic: '8× ConnectX-7 400Gb IB',
    dpu: '2× BlueField-3',
    dpuVfs: 16,
    mem: '2.3 TB DDR5',
    disk: '8× 7.68 TB U.2 NVMe',
    power: '10.4 kW',
  },
  'dgx-a100': {
    type: 'dgx-a100',
    label: 'NVIDIA DGX A100',
    cpu: '2× EPYC 7742 · 128C/256T',
    gpu: '8× A100 80GB SXM4',
    gpuCount: 8,
    nic: '8× ConnectX-6 200Gb IB',
    dpu: '1× BlueField-2',
    dpuVfs: 8,
    mem: '2 TB DDR4',
    disk: '4× 3.84 TB U.2 NVMe',
    power: '6.5 kW',
  },
  'mgx-gb200': {
    type: 'mgx-gb200',
    label: 'NVIDIA MGX GB200 NVL',
    cpu: '2× Grace · 144C Arm Neoverse',
    gpu: '4× B200 192GB',
    gpuCount: 4,
    nic: '4× ConnectX-8 800Gb IB',
    dpu: '2× BlueField-3',
    dpuVfs: 16,
    mem: '960 GB LPDDR5X',
    disk: '4× 7.68 TB E1.S NVMe',
    power: '13.5 kW',
  },
};

export interface OsImage {
  id: string;
  label: string;
  driver: string;
  doca: string;
  size: string;
}

export const OS_IMAGES: OsImage[] = [
  { id: 'dgx-os-6', label: 'DGX OS 6.2', driver: 'driver 550.90.07', doca: 'DOCA 2.7', size: '6.4 GB' },
  { id: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS', driver: 'driver 550.90.07', doca: 'DOCA 2.7', size: '2.1 GB' },
  { id: 'rhel-9.4', label: 'RHEL 9.4', driver: 'driver 550.90.07', doca: 'DOCA 2.7', size: '2.8 GB' },
  { id: 'rocky-9', label: 'Rocky Linux 9', driver: 'driver 550.90.07', doca: 'DOCA 2.7', size: '2.6 GB' },
];

export function osById(id: string): OsImage {
  return OS_IMAGES.find((o) => o.id === id) ?? OS_IMAGES[0];
}

// Deterministic identity facts derived from a node's number — BMC address, NIC
// MAC, chassis serial, the DHCP lease it gets, and its DPU PCIe address.
export interface NodeFacts {
  bmc: string;
  mac: string;
  serial: string;
  dhcp: string;
  dpuBdf: string;
}

const hx = (n: number) => n.toString(16).padStart(2, '0');

export function nodeFacts(num: number): NodeFacts {
  return {
    bmc: `10.42.0.${10 + num}`,
    mac: `b8:3f:d2:${hx((num * 37) % 256)}:${hx((num * 71) % 256)}:${hx((num * 13) % 256)}`,
    serial: `1660NV${String(2300000 + num * 4099).slice(0, 7)}`,
    dhcp: `10.0.${Math.floor(num / 250)}.${(num * 7) % 250 + 2}`,
    dpuBdf: `0000:${hx(0xa0 + num)}:00.0`,
  };
}

// The SR-IOV VF a tenant workload binds on this node's BlueField DPU.
export function vfFor(num: number): string {
  return `vf${num % 16}`;
}
