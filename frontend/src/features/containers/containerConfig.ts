import type { ContainerCreateConfig } from '@/types/docker';

export interface ContainerFormValues {
  image: string;
  command: string;
  environment: string;
  ports: string;
  mounts: string;
  restart: string;
  autoRemove: boolean;
  network: string;
}

interface PortMappingInput {
  hostIp: string;
  hostPort: string;
  containerPort: string;
  protocol: string;
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePortMapping(line: string): PortMappingInput | null {
  let protocol = 'tcp';
  let mapping = line;
  const slashIndex = mapping.indexOf('/');

  if (slashIndex >= 0) {
    protocol = mapping.slice(slashIndex + 1);
    mapping = mapping.slice(0, slashIndex);
  }

  const parts = mapping.split(':');
  if (parts.length === 2) {
    return { hostIp: '', hostPort: parts[0], containerPort: parts[1], protocol };
  }
  if (parts.length === 3) {
    return { hostIp: parts[0], hostPort: parts[1], containerPort: parts[2], protocol };
  }
  return null;
}

/** Converts controlled form values into the Docker create-container request. */
export function buildContainerConfig(values: ContainerFormValues): ContainerCreateConfig {
  const config: ContainerCreateConfig = { Image: values.image.trim(), Tty: false };
  const hostConfig: NonNullable<ContainerCreateConfig['HostConfig']> = {};

  const environment = parseLines(values.environment);
  if (environment.length) config.Env = environment;
  if (values.command.trim()) config.Cmd = values.command.trim().split(/\s+/);

  const ports = parseLines(values.ports);
  if (ports.length) {
    config.ExposedPorts = {};
    hostConfig.PortBindings = {};

    ports.forEach((line) => {
      const parsed = parsePortMapping(line);
      if (!parsed) throw new Error(`Invalid port mapping: "${line}"`);

      const key = `${parsed.containerPort}/${parsed.protocol}`;
      config.ExposedPorts![key] = {};
      hostConfig.PortBindings![key] = [
        {
          HostIp: parsed.hostIp,
          HostPort: parsed.hostPort,
        },
      ];
    });
  }

  const mounts = parseLines(values.mounts);
  if (mounts.length) {
    hostConfig.Binds = mounts.map((mount) => {
      if (mount.split(':').length < 2) {
        throw new Error(`Invalid mount: "${mount}" (expected source:target)`);
      }
      return mount;
    });
  }

  if (values.restart) hostConfig.RestartPolicy = { Name: values.restart };
  if (values.autoRemove) hostConfig.AutoRemove = true;
  if (values.network) hostConfig.NetworkMode = values.network;
  if (Object.keys(hostConfig).length) config.HostConfig = hostConfig;

  return config;
}
