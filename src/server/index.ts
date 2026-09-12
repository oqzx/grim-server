import { loadConfig, type GrimServerConfig } from '../config.js';
import { launchServer } from './launch.js';
export { resolveJava } from './java.js';
export type { LaunchOptions, ServerHandle } from './types.js';
export { launchServer } from './launch.js';
import type { LaunchOptions, ServerHandle } from './types.js';

export async function startServer(
  overrides: Partial<GrimServerConfig> = {},
  options: LaunchOptions = {},
): Promise<ServerHandle> {
  const loaded = await loadConfig();
  const config: GrimServerConfig = {
    ...loaded,
    ...overrides,
    memory: { ...loaded.memory, ...(overrides.memory ?? {}) },
    serverProperties: { ...loaded.serverProperties, ...(overrides.serverProperties ?? {}) },
    environment: { ...loaded.environment, ...(overrides.environment ?? {}) },
    javaArgs: overrides.javaArgs ? [...overrides.javaArgs] : [...loaded.javaArgs],
  };
  return launchServer(config, options);
}
