import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { enhanceProcess } from './process.js';
import { ensureServerFiles } from './properties.js';
import { installGrim, resolveServerArtifacts } from './artifacts.js';
import { resolveJava } from './java.js';
import type { GrimServerConfig } from '../config.js';
import type { LaunchOptions, ServerHandle } from './types.js';

export async function launchServer(
  config: GrimServerConfig,
  options: LaunchOptions = {},
): Promise<ServerHandle> {
  const artifacts = await resolveServerArtifacts(
    config.version,
    config.cacheDir,
    options,
    config.paperJar,
    config.grimJar,
  );
  await mkdir(config.serverDir, { recursive: true });
  await ensureServerFiles(config);
  await installGrim(config.serverDir, artifacts.grim);

  const java = await resolveJava(config.java);
  const child = spawn(
    java,
    [
      `-Xms${config.memory.min}`,
      `-Xmx${config.memory.max}`,
      ...config.javaArgs,
      '-jar',
      artifacts.paper.path,
      '--nogui',
    ],
    {
      cwd: config.serverDir,
      stdio:
        config.captureOutput && process.env.GRIM_CAPTURE !== '0'
          ? ['pipe', 'pipe', 'pipe']
          : 'inherit',
      env: {
        ...process.env,
        ...config.environment,
        GRIM_JAR: artifacts.grim.path,
        MINECRAFT_VERSION: artifacts.version,
        MINECRAFT_PORT: String(config.port),
      },
    },
  );
  return enhanceProcess(child);
}
