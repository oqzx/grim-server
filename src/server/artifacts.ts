import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile, resolveGrim, resolvePaper, type Artifact } from '../artifacts/index.js';
import type { DiscoveryOptions } from '../artifacts/index.js';
import type { ResolvedArtifact } from './types.js';

export async function resolveServerArtifacts(
  version: string,
  cacheDir: string,
  options: DiscoveryOptions,
  paperJar?: string,
  grimJar?: string,
): Promise<{ paper: ResolvedArtifact; grim: ResolvedArtifact; version: string }> {
  const paper = paperJar
    ? { path: paperJar }
    : await withArtifactPath(resolvePaper(version, { ...options, cacheDir }));
  const serverVersion = version === 'latest' && 'version' in paper ? paper.version : version;
  const grim = grimJar
    ? { path: grimJar }
    : await bundledGrimOrResolved(serverVersion, { ...options, cacheDir });
  return {
    paper: await withArtifactPath(Promise.resolve(paper)),
    grim: await withArtifactPath(Promise.resolve(grim)),
    version: serverVersion,
  };
}

export async function installGrim(serverDir: string, grim: ResolvedArtifact): Promise<void> {
  await mkdir(path.join(serverDir, 'plugins'), { recursive: true });
  await copyFile(grim.path, path.join(serverDir, 'plugins', path.basename(grim.path)));
}

async function bundledGrimOrResolved(
  minecraftVersion: string,
  options: DiscoveryOptions,
): Promise<ResolvedArtifact> {
  const bundled = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'vendor',
    'grim.json',
  );
  try {
    const manifest = JSON.parse(await readFile(bundled, 'utf8')) as {
      minecraftVersion?: string;
      filename?: string;
      checksum?: { algorithm?: 'sha1' | 'sha512'; value?: string };
    };
    if (manifest.minecraftVersion === minecraftVersion && manifest.filename) {
      const artifactPath = path.join(path.dirname(bundled), manifest.filename);
      if ((await isFile(artifactPath)) && manifest.checksum?.algorithm && manifest.checksum.value) {
        const checksum = await hashFile(artifactPath, manifest.checksum.algorithm);
        if (checksum === manifest.checksum.value) {
          return {
            name: manifest.filename,
            path: artifactPath,
            version: 'bundled',
            url: '',
            source: 'modrinth',
          };
        }
      }
    }
  } catch {
    return resolveGrimArtifact(minecraftVersion, options);
  }
  return resolveGrimArtifact(minecraftVersion, options);
}

async function resolveGrimArtifact(
  version: string,
  options: DiscoveryOptions,
): Promise<ResolvedArtifact> {
  return withArtifactPath(resolveGrim(version, options));
}

async function withArtifactPath(
  artifactPromise: Promise<Artifact | ResolvedArtifact | { path: string }>,
): Promise<ResolvedArtifact> {
  const artifact = await artifactPromise;
  if (!('path' in artifact)) throw new Error('Artifact cache path was not returned');
  return artifact as ResolvedArtifact;
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await import('node:fs/promises').then(({ stat }) => stat(file))).isFile();
  } catch {
    return false;
  }
}
