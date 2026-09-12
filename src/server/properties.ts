import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GrimServerConfig } from '../config.js';

export async function ensureServerFiles(config: GrimServerConfig): Promise<void> {
  await ensureFile(path.join(config.serverDir, 'eula.txt'), 'eula=true\n');
  await ensureProperties(config);
}

async function ensureProperties(config: GrimServerConfig): Promise<void> {
  const file = path.join(config.serverDir, 'server.properties');
  const values = await readProperties(file);
  values.set('online-mode', String(config.onlineMode));
  values.set('allow-flight', String(config.allowFlight));
  values.set('motd', sanitize(config.motd));
  values.set('server-port', String(config.port));
  for (const [key, value] of Object.entries(config.serverProperties)) {
    values.set(key, sanitize(String(value)));
  }
  await writeFile(
    file,
    [...values].map(([key, value]) => `${key}=${value}`).join('\n') + '\n',
    'utf8',
  );
}

async function readProperties(file: string): Promise<Map<string, string>> {
  try {
    const current = await readFile(file, 'utf8');
    const values = new Map<string, string>();
    for (const line of current.split(/\r?\n/)) {
      const index = line.indexOf('=');
      if (index > 0) values.set(line.slice(0, index), line.slice(index + 1));
    }
    return values;
  } catch {
    return new Map();
  }
}

async function ensureFile(file: string, content: string): Promise<void> {
  try {
    await access(file);
  } catch {
    await writeFile(file, content, 'utf8');
  }
}

function sanitize(value: string): string {
  return value.replace(/\r?\n/g, ' ');
}
