// Types for the Docker Engine API fields used by this application.
// Docker returns more fields than these; optional properties keep the UI
// compatible across engine versions without declaring the entire API.

export type ContainerState =
  'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';

export interface PortMapping {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: 'tcp' | 'udp' | 'sctp';
}

export interface Mount {
  Type?: string;
  Name?: string;
  Source?: string;
  Destination?: string;
  Mode?: string;
  RW?: boolean;
}

export interface ContainerSummary {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: ContainerState | string;
  Status: string;
  Ports: PortMapping[];
  Labels: Record<string, string>;
  SizeRootFs?: number;
  SizeRw?: number;
  Mounts?: Mount[];
  NetworkSettings?: { Networks?: Record<string, unknown> };
  HostConfig?: { NetworkMode?: string };
}

export interface ContainerStateDetail {
  Status: ContainerState | string;
  Running: boolean;
  Paused: boolean;
  Restarting: boolean;
  OOMKilled: boolean;
  Dead: boolean;
  Pid: number;
  ExitCode: number;
  Error?: string;
  StartedAt: string;
  FinishedAt: string;
}

export interface ContainerInspect {
  Id: string;
  Created: string;
  Path?: string;
  Args?: string[];
  Name: string;
  RestartCount: number;
  Driver?: string;
  Platform?: string;
  Mountpoint?: string;
  Os?: string;
  Architecture?: string;
  State: ContainerStateDetail;
  Image: string;
  Config?: {
    Image?: string;
    Cmd?: string[] | null;
    Entrypoint?: string[] | null;
    Env?: string[] | null;
    Tty?: boolean;
    Labels?: Record<string, string> | null;
    ExposedPorts?: Record<string, unknown> | null;
  };
  HostConfig?: {
    RestartPolicy?: { Name?: string; MaximumRetryCount?: number };
    AutoRemove?: boolean;
    Privileged?: boolean;
    Binds?: string[] | null;
    NetworkMode?: string;
    PortBindings?: Record<string, unknown> | null;
  };
  NetworkSettings?: {
    IPAddress?: string;
    Gateway?: string;
    MacAddress?: string;
    Ports?: Record<string, unknown> | null;
    Networks?: Record<string, { IPAddress?: string; Gateway?: string; NetworkID?: string }>;
  };
  Mounts?: Mount[];
}

export interface ImageSummary {
  Id: string;
  RepoTags: string[] | null;
  RepoDigests: string[] | null;
  Created: number;
  Size: number;
  VirtualSize?: number;
  SharedSize?: number;
  Labels?: Record<string, string> | null;
  Containers?: number;
}

export interface VolumeSummary {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Created?: string;
  Labels?: Record<string, string> | null;
  Scope: 'local' | 'global' | string;
  Options?: Record<string, string> | null;
  UsageData?: { Size: number; RefCount: number };
}

export interface VolumesResponse {
  Volumes: VolumeSummary[] | null;
  Warnings?: string[] | null;
}

export interface NetworkSummary {
  Name: string;
  Id: string;
  Created?: string;
  Scope: string;
  Driver: string;
  EnableIPv6?: boolean;
  IPAM?: { Driver?: string; Config?: Array<Record<string, string>> };
  Internal?: boolean;
  Attachable?: boolean;
  Ingress?: boolean;
  Containers?: Record<string, { Name: string; EndpointID: string; IPv4Address: string }> | null;
  Labels?: Record<string, string> | null;
}

export interface VersionResponse {
  Version: string;
  ApiVersion: string;
  MinAPIVersion?: string;
  Os: string;
  Arch: string;
  KernelVersion?: string;
  GitCommit?: string;
  BuildTime?: string;
}

export interface InfoResponse {
  ID?: string;
  Containers?: number;
  ContainersRunning?: number;
  ContainersPaused?: number;
  ContainersStopped?: number;
  Images?: number;
  Driver?: string;
  MemTotal?: number;
  NCPU?: number;
  OperatingSystem?: string;
  OSType?: string;
  Architecture?: string;
  KernelVersion?: string;
  ServerVersion?: string;
  Name?: string;
  DockerRootDir?: string;
  SystemTime?: string;
}

export interface DiskUsage {
  LayersSize?: number;
  Images?: ImageSummary[];
  Containers?: ContainerSummary[];
  Volumes?: VolumeSummary[];
  BuildCache?: unknown[];
}

export interface ContainerTop {
  Titles: string[];
  Processes: string[][];
}

export interface StatsSample {
  read?: string;
  preread?: string;
  cpu_stats: {
    cpu_usage: { total_usage: number; percpu_usage?: number[] };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number; percpu_usage?: number[] };
    system_cpu_usage?: number;
    online_cpus?: number;
  };
  memory_stats: {
    usage?: number;
    limit?: number;
    stats?: { cache?: number; inactive_file?: number };
  };
  networks?: Record<string, { rx_bytes: number; tx_bytes: number }>;
  blkio_stats?: {
    io_service_bytes_recursive?: Array<{ op: string; value: number }>;
  };
  pids_stats?: { current?: number; limit?: number };
}

export interface ContainerCreateConfig {
  Image: string;
  Cmd?: string[];
  Env?: string[];
  Tty?: boolean;
  ExposedPorts?: Record<string, Record<string, never>>;
  HostConfig?: {
    PortBindings?: Record<string, Array<{ HostIp: string; HostPort: string }>>;
    Binds?: string[];
    RestartPolicy?: { Name: string; MaximumRetryCount?: number };
    AutoRemove?: boolean;
    NetworkMode?: string;
  };
}

export interface CreateResponse {
  Id: string;
  Warnings?: string[] | null;
}

export interface PruneResponse {
  ContainersDeleted?: string[];
  ImagesDeleted?: Array<{ Untagged?: string; Deleted?: string }>;
  VolumesDeleted?: string[];
  NetworksDeleted?: string[];
  CachesDeleted?: unknown[];
  SpaceReclaimed?: number;
}

export interface DockerEvent {
  status: string;
  id: string;
  from?: string;
  Type?: string;
  Action?: string;
  time: number;
  timeNano?: number;
  Actor?: { ID: string; Attributes: Record<string, string> };
}
