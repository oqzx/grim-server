import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type MemoryConfig = {
  min: string;
  max: string;
};

export type MinecraftProperties = Record<string, string | number | boolean>;

export type GrimServerConfig = {
  version: string;
  serverDir: string;
  cacheDir: string;
  port: number;
  motd: string;
  onlineMode: boolean;
  allowFlight: boolean;
  memory: MemoryConfig;
  serverProperties: MinecraftProperties;
  javaArgs: string[];
  environment: Record<string, string>;
  captureOutput: boolean;
  java?: string;
  paperJar?: string;
  grimJar?: string;
};

export const configFileName = 'grim-server.config.json';

export const defaultConfig: Omit<GrimServerConfig, 'serverDir' | 'cacheDir'> & {
  serverDir: string;
  cacheDir: string;
} = {
  version: '1.21.11',
  serverDir: '.grim-server',
  cacheDir: '.grim-cache',
  port: 25565,
  motd: 'Grim Minecraft Server',
  onlineMode: false,
  allowFlight: true,
  memory: {
    min: '1G',
    max: '2G',
  },
  serverProperties: {},
  javaArgs: [],
  environment: {},
  captureOutput: true,
};

export async function loadConfig(
  cwd = process.cwd(),
  file = configFileName,
): Promise<GrimServerConfig> {
  const filePath = path.resolve(cwd, file);
  try {
    const text = await import('node:fs/promises').then(({ readFile }) =>
      readFile(filePath, 'utf8'),
    );
    return normalizeConfig(JSON.parse(text) as unknown, cwd);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return normalizeConfig({}, cwd);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Unable to parse ${file}: ${error.message}`);
    }
    throw new Error(
      `Unable to read ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function writeDefaultConfig(
  cwd = process.cwd(),
  file = configFileName,
): Promise<string> {
  const filePath = path.resolve(cwd, file);
  try {
    await access(filePath);
    throw new Error(`${file} already exists`);
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('already exists')) throw error;
  }
  await writeFile(filePath, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  return filePath;
}

export function normalizeConfig(value: unknown, cwd = process.cwd()): GrimServerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Server config must be a JSON object');
  }
  const input = value as Record<string, unknown>;
  const memory =
    input.memory && typeof input.memory === 'object' && !Array.isArray(input.memory)
      ? (input.memory as Record<string, unknown>)
      : {};
  const config: GrimServerConfig = {
    version: stringValue(input.version, defaultConfig.version),
    serverDir: resolveConfiguredPath(cwd, stringValue(input.serverDir, defaultConfig.serverDir)),
    cacheDir: resolveConfiguredPath(cwd, stringValue(input.cacheDir, defaultConfig.cacheDir)),
    port: numberValue(input.port, defaultConfig.port),
    motd: stringValue(input.motd, defaultConfig.motd),
    onlineMode: booleanValue(input.onlineMode, defaultConfig.onlineMode),
    allowFlight: booleanValue(input.allowFlight, defaultConfig.allowFlight),
    memory: {
      min: stringValue(memory.min, defaultConfig.memory.min),
      max: stringValue(memory.max, defaultConfig.memory.max),
    },
    serverProperties: propertiesValue(input.serverProperties),
    javaArgs: stringArrayValue(input.javaArgs, 'javaArgs'),
    environment: environmentValue(input.environment),
    captureOutput: booleanValue(input.captureOutput, defaultConfig.captureOutput),
  };
  for (const key of ['java', 'paperJar', 'grimJar'] as const) {
    const entry = input[key];
    if (entry !== undefined) {
      if (typeof entry !== 'string' || entry.length === 0) {
        throw new Error(`${key} must be a non-empty string`);
      }
      const value =
        key === 'java' && !looksLikePath(entry) ? entry : resolveConfiguredPath(cwd, entry);
      config[key] = value;
    }
  }
  if (!/^[\w.-]+$/.test(config.version)) throw new Error('version contains unsupported characters');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('port must be an integer between 1 and 65535');
  }
  return config;
}

function resolveConfiguredPath(cwd: string, value: string): string {
  const pathImpl = shouldUseWin32(cwd, value) ? path.win32 : path.posix;
  return pathImpl.isAbsolute(value) ? pathImpl.resolve(value) : pathImpl.resolve(cwd, value);
}

function shouldUseWin32(cwd: string, value: string): boolean {
  return process.platform === 'win32' || looksLikeWindowsPath(cwd) || looksLikeWindowsPath(value);
}

function looksLikeWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('//');
}

function looksLikePath(value: string): boolean {
  return (
    looksLikeWindowsPath(value) ||
    value.startsWith('/') ||
    value.startsWith('\\') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.includes('/') ||
    value.includes('\\')
  );
}

function stringValue(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('config string values must be non-empty strings');
  }
  return value;
}

function numberValue(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('config number values must be finite numbers');
  }
  return value;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error('config boolean values must be booleans');
  return value;
}

function propertiesValue(value: unknown): MinecraftProperties {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('serverProperties must be an object');
  }
  const properties: MinecraftProperties = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!key || typeof entry === 'object' || entry === null) {
      throw new Error(`serverProperties.${key} must be a string, number, or boolean`);
    }
    if (typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean') {
      throw new Error(`serverProperties.${key} must be a string, number, or boolean`);
    }
    properties[key] = entry;
  }
  return properties;
}

function stringArrayValue(value: unknown, key: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${key} must be an array of strings`);
  }
  return [...value];
}

function environmentValue(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('environment must be an object');
  }
  const environment: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') throw new Error(`environment.${key} must be a string`);
    environment[key] = entry;
  }
  return environment;
}
