import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, rename, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { request } from './http.js';
import type { Artifact, DiscoveryOptions } from './types.js';

export async function cacheArtifact(
  artifact: Artifact,
  cacheDir: string,
  options: DiscoveryOptions = {},
): Promise<Artifact & { path: string }> {
  await mkdir(cacheDir, { recursive: true });
  const target = path.join(cacheDir, safeName(artifact.name));
  if (await matchesChecksum(target, artifact)) return { ...artifact, path: target };
  await rm(target, { force: true });
  const temporary = `${target}.${process.pid}.${randomUUID()}.part`;
  try {
    await downloadToFile(artifact, temporary, options);
    if (
      artifact.sha256 &&
      (await hashFile(temporary, 'sha256')) !== artifact.sha256.toLowerCase()
    ) {
      throw new Error(`SHA-256 verification failed for ${artifact.name}`);
    }
    if (artifact.checksum) {
      const actual = await hashFile(temporary, artifact.checksum.algorithm);
      if (actual !== artifact.checksum.value.toLowerCase()) {
        throw new Error(`${artifact.checksum.algorithm} verification failed for ${artifact.name}`);
      }
    }
    await rename(temporary, target);
    return { ...artifact, path: target };
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function hashFile(
  file: string,
  algorithm: 'sha256' | 'sha1' | 'sha512' = 'sha256',
): Promise<string> {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex').toLowerCase();
}

async function downloadToFile(
  artifact: Artifact,
  file: string,
  options: DiscoveryOptions,
): Promise<void> {
  const response = await request(
    artifact.url,
    { headers: { 'User-Agent': 'grim-server' } },
    options,
  );
  if (!response.ok || !response.body) {
    throw new Error(`Unable to download ${artifact.name}: HTTP ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
    createWriteStream(file),
  );
}

async function matchesChecksum(file: string, artifact: Artifact): Promise<boolean> {
  try {
    const info = await stat(file);
    if (info.size === 0) return false;
    if (artifact.sha256) return (await hashFile(file)) === artifact.sha256.toLowerCase();
    if (artifact.checksum) {
      return (
        (await hashFile(file, artifact.checksum.algorithm)) ===
        artifact.checksum.value.toLowerCase()
      );
    }
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function safeName(name: string): string {
  const normalized = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!normalized || normalized === '.' || normalized === '..') {
    throw new Error('Artifact name is invalid');
  }
  return normalized;
}
